import { Router, Response } from "express";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import env from "../../config/env";
import logger from "../../config/logger";
import { prisma } from "../../config/db";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { authRateLimitMiddleware } from "../../middlewares/rateLimit.middleware";
import authMiddleware, { AuthRequest } from "../../middlewares/auth.middleware";
import AuthService from "./auth.service";

// Face ID / fingerprint sign-in (WebAuthn passkeys). The customer turns it on once from Profile while signed in; after that the
// phone's own Face ID, fingerprint or screen lock signs them in. The server keeps only the public key. Challenges are not stored:
// each one travels inside a short-lived signed token that must come back with the answer.

const router = Router();
const CHALLENGE_MINUTES = 5;
const FAILED = "Face ID sign-in failed. Use your password.";
const EXPIRED = "That Face ID request expired. Please try again.";

const signChallenge = (challenge: string, purpose: "register" | "login", userId?: string) =>
  jwt.sign({ challenge, purpose, userId }, env.JWT_SECRET, { expiresIn: `${CHALLENGE_MINUTES}m` });

function readChallenge(token: string, purpose: "register" | "login"): { challenge: string; userId?: string } {
  try {
    const p = jwt.verify(token, env.JWT_SECRET) as { challenge?: string; purpose?: string; userId?: string };
    if (p.purpose !== purpose || !p.challenge) throw new Error("wrong purpose");
    return { challenge: p.challenge, userId: p.userId };
  } catch {
    throw new AppError(400, EXPIRED);
  }
}

const b64 = (buf: Uint8Array) => Buffer.from(buf).toString("base64url");
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
const transportsOf = (s: string | null) => (s?.split(",").filter(Boolean) ?? undefined) as AuthenticatorTransportFuture[] | undefined;

// --- turn it on (signed in) ---------------------------------------------------------------------------------------------

router.post(
  "/passkey/register/options",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true } });
    const existing = await prisma.passkey.findMany({ where: { userId }, select: { credentialId: true, transports: true } });
    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userID: userId,
      userName: userId,
      userDisplayName: user?.name || userId,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: fromB64(c.credentialId), type: "public-key" as const, transports: transportsOf(c.transports) })),
      authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    });
    res.json(ApiResponseUtil.success(200, "Ready", { options, challengeToken: signChallenge(options.challenge, "register", userId) }));
  }),
);

router.post(
  "/passkey/register/verify",
  authMiddleware,
  [body("response").isObject(), body("challengeToken").isString().notEmpty(), body("deviceName").optional({ values: "falsy" }).isString().isLength({ max: 60 })],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { challenge, userId: forUser } = readChallenge(req.body.challengeToken, "register");
    if (forUser !== userId) throw new AppError(400, EXPIRED);
    let v;
    try {
      v = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge: challenge, expectedOrigin: env.WEBAUTHN_ORIGINS, expectedRPID: env.WEBAUTHN_RP_ID, requireUserVerification: true });
    } catch (e) {
      logger.warn(`Face ID setup failed for ${userId.slice(0, 3)}*******: ${(e as Error).message}`);
      throw new AppError(400, "Could not turn on Face ID on this device.");
    }
    if (!v.verified || !v.registrationInfo) throw new AppError(400, "Could not turn on Face ID on this device.");
    const { credentialID, credentialPublicKey, counter } = v.registrationInfo;
    const credentialId = b64(credentialID);
    const transports = ((req.body.response?.response?.transports as string[] | undefined) ?? []).join(",") || null;
    const data = { userId, publicKey: b64(credentialPublicKey), counter, transports, deviceName: req.body.deviceName || null };
    await prisma.passkey.upsert({ where: { credentialId }, create: { credentialId, ...data }, update: data });
    res.json(ApiResponseUtil.success(200, "Face ID is on for this device"));
  }),
);

router.get(
  "/passkey",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await prisma.passkey.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, select: { id: true, credentialId: true, deviceName: true, createdAt: true, lastUsedAt: true } });
    res.json(ApiResponseUtil.success(200, "OK", rows));
  }),
);

router.delete(
  "/passkey/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.passkey.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.json(ApiResponseUtil.success(200, "Face ID turned off"));
  }),
);

// --- sign in (not signed in) --------------------------------------------------------------------------------------------

router.post(
  "/passkey/login/options",
  authRateLimitMiddleware,
  asyncHandler(async (_req, res: Response) => {
    // no phone number needed: the phone offers the account it holds a key for
    const options = await generateAuthenticationOptions({ rpID: env.WEBAUTHN_RP_ID, userVerification: "required", allowCredentials: [] });
    res.json(ApiResponseUtil.success(200, "Ready", { options, challengeToken: signChallenge(options.challenge, "login") }));
  }),
);

router.post(
  "/passkey/login/verify",
  authRateLimitMiddleware,
  [body("response").isObject(), body("challengeToken").isString().notEmpty()],
  validateRequest,
  asyncHandler(async (req, res: Response) => {
    const { challenge } = readChallenge(req.body.challengeToken, "login");
    const credentialId = String(req.body.response?.id ?? "");
    const pk = credentialId ? await prisma.passkey.findUnique({ where: { credentialId } }) : null;
    if (!pk) throw new AppError(401, FAILED);
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response: req.body.response,
        expectedChallenge: challenge,
        expectedOrigin: env.WEBAUTHN_ORIGINS,
        expectedRPID: env.WEBAUTHN_RP_ID,
        requireUserVerification: true,
        authenticator: { credentialID: fromB64(pk.credentialId), credentialPublicKey: fromB64(pk.publicKey), counter: pk.counter, transports: transportsOf(pk.transports) },
      });
    } catch (e) {
      logger.warn(`Face ID sign-in rejected: ${(e as Error).message}`);
      throw new AppError(401, FAILED);
    }
    if (!v.verified) throw new AppError(401, FAILED);
    await prisma.passkey.update({ where: { id: pk.id }, data: { counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() } });
    const result = await AuthService.loginWithPasskey(pk.userId);
    res.json(ApiResponseUtil.success(200, "Logged in successfully", result));
  }),
);

export default router;
