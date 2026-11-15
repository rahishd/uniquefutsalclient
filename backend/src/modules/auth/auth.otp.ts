import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Router, Response } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";
import { prisma } from "../../config/db";
import env from "../../config/env";
import logger from "../../config/logger";
import smsService from "../../services/sms.service";
import { renderSms } from "../../services/smsTemplates";
import validateRequest from "../../middlewares/validate.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { HashUtil } from "../../utils/hash";
import { JwtUtil } from "../../utils/jwt";
import { cleanEmergency } from "../../utils/emergency";
import { isValidDob, MAX_AGE, MIN_AGE } from "../../utils/age";
import { todayKey } from "../../utils/dates";
import AuthService from "./auth.service";
import { SUSPENDED_MESSAGE } from "../../middlewares/auth.middleware";
import type { AuthResponse } from "./auth.dto";

// One-time codes by SMS.
//   signup : a new customer proves the phone number with a code, THEN chooses a password
//   reset  : "Forgot password": a registered customer proves the number with a code, THEN chooses a new password
// There is NO sign-in by code: signing in always needs the password.
// Rules: a code lasts 10 minutes and works once; 5 wrong tries kill it; one new code a minute, 5 an hour per number.
// Only a hash of the code is stored. A reset code is only for registered customers (an unknown number is told to create an account).
const TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_TRIES = 5;
const PHONE = /^9\d{9}$/;
const SIGNUP_TOKEN_MIN = 20; // minutes to choose a password after the code was accepted

type Purpose = "signup" | "reset";

const hashCode = (phone: string, purpose: Purpose, code: string) => crypto.createHmac("sha256", env.JWT_SECRET).update(`${phone}:${purpose}:${code}`).digest("hex");
const signupSecret = () => `${env.JWT_SECRET}:signup-otp`; // a different key, so a sign-up pass can never be used as a sign-in token
const resetSecret = () => `${env.JWT_SECRET}:reset-otp`; // and a different one again for the new-password pass

export async function requestCode(phone: string, purpose: Purpose): Promise<{ sent: true; resendInSeconds: number }> {
  if (!PHONE.test(phone)) throw new AppError(400, "Enter a 10-digit mobile number starting with 9");
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  const reply = { sent: true as const, resendInSeconds: RESEND_GAP_MS / 1000 };

  if (purpose === "reset") {
    // Only a registered customer gets a reset code. No code is sent, and none can be used, for a number with no account.
    if (!user || user.role !== "user") throw new AppError(404, "This mobile number is not registered. Please create an account first.");
    if (!user.isActive) throw new AppError(403, SUSPENDED_MESSAGE);
  } else if (user) {
    throw new AppError(409, "This mobile number is already registered. Please sign in instead.");
  }

  const now = Date.now();
  const existing = await prisma.loginOtp.findUnique({ where: { phoneNumber_purpose: { phoneNumber: phone, purpose } } });
  let sends = 1;
  let windowStart = new Date(now);
  if (existing) {
    if (now - existing.sentAt.getTime() < RESEND_GAP_MS) throw new AppError(429, "Please wait a minute before asking for another code.");
    if (now - existing.windowStart.getTime() < 60 * 60 * 1000) {
      if (existing.sends >= MAX_SENDS_PER_HOUR) throw new AppError(429, "Too many codes asked for this number. Try again in an hour.");
      sends = existing.sends + 1;
      windowStart = existing.windowStart;
    }
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const data = { codeHash: hashCode(phone, purpose, code), expiresAt: new Date(now + TTL_MS), tries: 0, sends, windowStart, sentAt: new Date(now) };
  await prisma.loginOtp.upsert({ where: { phoneNumber_purpose: { phoneNumber: phone, purpose } }, update: data, create: { phoneNumber: phone, purpose, ...data } });

  // the wording is edited in the admin portal (SMS page); the log keeps it with the digits hidden
  const message = await renderSms("otp", { otp: code });
  const ok = await smsService.send({ phoneNumber: phone, message, kind: "otp", logMessage: await renderSms("otp", { otp: "••••••" }), recipientName: user?.name ?? null });
  if (!ok) {
    if (process.env.NODE_ENV === "development") {
      logger.info(`OTP for ${phone} (${purpose}): ${code} (development only: the text could not be sent)`);
    } else {
      await prisma.loginOtp.delete({ where: { phoneNumber_purpose: { phoneNumber: phone, purpose } } }).catch(() => undefined);
      throw new AppError(503, "We could not send the code right now. Please try again in a moment.");
    }
  }
  return reply;
}

async function checkCode(phone: string, purpose: Purpose, code: string): Promise<void> {
  const row = await prisma.loginOtp.findUnique({ where: { phoneNumber_purpose: { phoneNumber: phone, purpose } } });
  if (!row || row.expiresAt.getTime() < Date.now()) throw new AppError(401, "This code has expired. Ask for a new one.");
  if (row.tries >= MAX_TRIES) {
    await prisma.loginOtp.delete({ where: { id: row.id } }).catch(() => undefined);
    throw new AppError(429, "Too many wrong tries. Ask for a new code.");
  }
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(hashCode(phone, purpose, code));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await prisma.loginOtp.update({ where: { id: row.id }, data: { tries: { increment: 1 } } });
    throw new AppError(401, "That code is not right.");
  }
  // used once: the row goes (a second try with the same code fails)
  const gone = await prisma.loginOtp.deleteMany({ where: { id: row.id } });
  if (gone.count !== 1) throw new AppError(401, "This code was already used. Ask for a new one.");
}

export async function verifyReset(phone: string, code: string): Promise<{ resetToken: string }> {
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (!user || user.role !== "user") throw new AppError(404, "This mobile number is not registered. Please create an account first.");
  if (!user.isActive) throw new AppError(403, SUSPENDED_MESSAGE);
  await checkCode(phone, "reset", code);
  return { resetToken: jwt.sign({ purpose: "reset", phone }, resetSecret(), { expiresIn: `${SIGNUP_TOKEN_MIN}m` }) };
}

/** The last step of "Forgot password": the pass from verifyReset plus a new password. The customer then signs in with it. */
export async function resetPasswordWithCode(resetToken: string, newPassword: string): Promise<void> {
  let phone: string;
  try {
    const p = jwt.verify(resetToken, resetSecret()) as { purpose?: string; phone?: string };
    if (p.purpose !== "reset" || !p.phone) throw new Error("wrong token");
    phone = p.phone;
  } catch {
    throw new AppError(401, "Your verification expired. Please ask for a new code.");
  }
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (!user || user.role !== "user") throw new AppError(404, "This mobile number is not registered. Please create an account first.");
  if (!user.isActive) throw new AppError(403, SUSPENDED_MESSAGE);
  await prisma.user.update({ where: { phoneNumber: phone }, data: { password: await HashUtil.hash(newPassword) } });
  logger.info(`Password reset by code for ${phone.slice(0, 3)}*******`);
}

export async function verifySignup(phone: string, code: string): Promise<{ signupToken: string }> {
  if (await prisma.user.findUnique({ where: { phoneNumber: phone } })) throw new AppError(409, "This mobile number is already registered. Please sign in instead.");
  await checkCode(phone, "signup", code);
  return { signupToken: jwt.sign({ purpose: "signup", phone }, signupSecret(), { expiresIn: `${SIGNUP_TOKEN_MIN}m` }) };
}

export interface CompleteSignup {
  signupToken: string;
  password: string;
  name: string;
  dateOfBirth?: string;
  email?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export async function completeSignup(dto: CompleteSignup): Promise<AuthResponse> {
  let phone: string;
  try {
    const p = jwt.verify(dto.signupToken, signupSecret()) as { purpose?: string; phone?: string };
    if (p.purpose !== "signup" || !p.phone) throw new Error("wrong token");
    phone = p.phone;
  } catch {
    throw new AppError(401, "Your verification expired. Please verify your mobile number again.");
  }
  if (await prisma.user.findUnique({ where: { phoneNumber: phone } })) throw new AppError(409, "This mobile number is already registered. Please sign in instead.");
  if (!isValidDob(dto.dateOfBirth, todayKey())) throw new AppError(400, `Enter your date of birth (age ${MIN_AGE} to ${MAX_AGE}).`);
  const emergency = cleanEmergency(dto, phone);

  const created = await prisma.user.create({
    data: {
      phoneNumber: phone,
      name: dto.name.trim(),
      email: dto.email || null,
      password: await HashUtil.hash(dto.password),
      dateOfBirth: dto.dateOfBirth,
      ...emergency,
      isVerified: true, // the phone number was proven with the code
      role: "user",
    },
  });
  logger.info(`User ${created.phoneNumber} registered with a verified phone number.`);
  const claims = { id: created.phoneNumber, email: created.email || undefined, role: "user" };
  return {
    token: JwtUtil.sign(claims),
    refreshToken: JwtUtil.signRefresh(claims),
    user: { id: created.phoneNumber, email: created.email, name: created.name || "", phoneNumber: created.phoneNumber, role: "user", freeMatchesAvailable: created.freeMatchesAvailable, isVerified: true },
  };
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40, // per address; the per-number limits above do the real work
  message: "Too many requests, please try again later.",
  skip: () => process.env.NODE_ENV !== "production",
});

const router = Router();
const phoneRule = body("phoneNumber").matches(PHONE).withMessage("Enter a 10-digit mobile number starting with 9");
const purposeRule = body("purpose").isIn(["signup", "reset"]);
const codeRule = body("code").matches(/^\d{6}$/).withMessage("Enter the 6-digit code");

router.post("/otp/request", limiter, [phoneRule, purposeRule], validateRequest, asyncHandler(async (req, res: Response) => {
  const r = await requestCode(req.body.phoneNumber, req.body.purpose);
  res.json(ApiResponseUtil.success(200, "If the number can receive a code, it was sent.", r));
}));

router.post("/otp/verify", limiter, [phoneRule, purposeRule, codeRule], validateRequest, asyncHandler(async (req, res: Response) => {
  if (req.body.purpose === "reset") res.json(ApiResponseUtil.success(200, "Mobile number verified", await verifyReset(req.body.phoneNumber, req.body.code)));
  else res.json(ApiResponseUtil.success(200, "Mobile number verified", await verifySignup(req.body.phoneNumber, req.body.code)));
}));

router.post(
  "/otp/reset-password",
  limiter,
  [body("resetToken").notEmpty(), body("newPassword").isLength({ min: 6 }).withMessage("Use at least 6 characters")],
  validateRequest,
  asyncHandler(async (req, res: Response) => {
    await resetPasswordWithCode(req.body.resetToken, req.body.newPassword);
    res.json(ApiResponseUtil.success(200, "Password changed. You can sign in now."));
  }),
);

router.post(
  "/signup/complete",
  limiter,
  [
    body("signupToken").notEmpty(),
    body("password").isLength({ min: 6 }).withMessage("Use at least 6 characters"),
    body("name").trim().isLength({ min: 2 }),
    body("dateOfBirth").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Enter your date of birth"),
    body("emergencyName").optional({ values: "falsy" }).isString(),
    body("emergencyPhone").optional({ values: "falsy" }).isString(),
    body("emergencyRelation").optional({ values: "falsy" }).isString(),
  ],
  validateRequest,
  asyncHandler(async (req, res: Response) => {
    res.status(201).json(ApiResponseUtil.success(201, "Account created successfully", await completeSignup(req.body)));
  }),
);

export default router;
