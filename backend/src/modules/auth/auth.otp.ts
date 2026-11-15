import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Router, Response } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";
import { prisma } from "../../config/db";
import env from "../../config/env";
import logger from "../../config/logger";
import smsService from "../../services/sms.service";
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
import type { AuthResponse } from "./auth.dto";

// One-time codes by SMS.
//   login  : "Continue with OTP" on the sign-in page (the password still works too)
//   signup : a new customer proves the phone number with a code, THEN chooses a password
// Rules: a code lasts 10 minutes and works once; 5 wrong tries kill it; one new code a minute, 5 an hour per number.
// Only a hash of the code is stored. Sign-in never tells whether a number has an account.
const TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_TRIES = 5;
const PHONE = /^9\d{9}$/;
const SIGNUP_TOKEN_MIN = 20; // minutes to choose a password after the code was accepted

type Purpose = "login" | "signup";

const hashCode = (phone: string, purpose: Purpose, code: string) => crypto.createHmac("sha256", env.JWT_SECRET).update(`${phone}:${purpose}:${code}`).digest("hex");
const signupSecret = () => `${env.JWT_SECRET}:signup-otp`; // a different key, so a sign-up pass can never be used as a sign-in token

export async function requestCode(phone: string, purpose: Purpose): Promise<{ sent: true; resendInSeconds: number }> {
  if (!PHONE.test(phone)) throw new AppError(400, "Enter a 10-digit mobile number starting with 9");
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  const reply = { sent: true as const, resendInSeconds: RESEND_GAP_MS / 1000 };

  if (purpose === "login") {
    // no account, a suspended one, or a staff account: pretend it was sent (nothing is revealed, nothing is sent)
    if (!user || !user.isActive || user.role !== "user") return reply;
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
      if (existing.sends >= MAX_SENDS_PER_HOUR) throw new AppError(429, "Too many codes asked for this number. Try again in an hour or use your password.");
      sends = existing.sends + 1;
      windowStart = existing.windowStart;
    }
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const data = { codeHash: hashCode(phone, purpose, code), expiresAt: new Date(now + TTL_MS), tries: 0, sends, windowStart, sentAt: new Date(now) };
  await prisma.loginOtp.upsert({ where: { phoneNumber_purpose: { phoneNumber: phone, purpose } }, update: data, create: { phoneNumber: phone, purpose, ...data } });

  const ok = await smsService.send({ phoneNumber: phone, message: `${code} is your Unique Futsal code. It works for 10 minutes. Do not share it with anyone.` });
  if (!ok) {
    if (process.env.NODE_ENV === "development") {
      logger.info(`OTP for ${phone} (${purpose}): ${code} (development only: the text could not be sent)`);
    } else {
      await prisma.loginOtp.delete({ where: { phoneNumber_purpose: { phoneNumber: phone, purpose } } }).catch(() => undefined);
      throw new AppError(503, "We could not send the code right now. Please try again, or use your password.");
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

export async function verifyLogin(phone: string, code: string): Promise<AuthResponse> {
  await checkCode(phone, "login", code);
  return AuthService.loginWithPasskey(phone); // the same checks and the same result as the password sign-in
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
const purposeRule = body("purpose").isIn(["login", "signup"]);
const codeRule = body("code").matches(/^\d{6}$/).withMessage("Enter the 6-digit code");

router.post("/otp/request", limiter, [phoneRule, purposeRule], validateRequest, asyncHandler(async (req, res: Response) => {
  const r = await requestCode(req.body.phoneNumber, req.body.purpose);
  res.json(ApiResponseUtil.success(200, "If the number can receive a code, it was sent.", r));
}));

router.post("/otp/verify", limiter, [phoneRule, purposeRule, codeRule], validateRequest, asyncHandler(async (req, res: Response) => {
  if (req.body.purpose === "login") res.json(ApiResponseUtil.success(200, "Logged in successfully", await verifyLogin(req.body.phoneNumber, req.body.code)));
  else res.json(ApiResponseUtil.success(200, "Mobile number verified", await verifySignup(req.body.phoneNumber, req.body.code)));
}));

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
