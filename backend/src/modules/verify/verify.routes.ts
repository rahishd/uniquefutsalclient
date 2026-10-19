import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import { prisma } from "../../config/db";
import { createWithCode } from "./verify.codes";
import { attemptsLeft, lookupCode, recordWrong } from "./verify.service";

// POST /api/verify {code}: public, no sign-in. Is this code on a bill or document genuine, and what does it cover?
// The code goes in the body, not the address, so it does not end up in logs. A wrong code is a 404 ("fake").
export const verifyRouter = Router();

verifyRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const code = String((req.body as { code?: unknown })?.code ?? "").replace(/\s+/g, "").toUpperCase();
    if (!/^[0-9A-Z]{4,6}$/.test(code)) throw new AppError(400, "Enter the 5-character verification code (like 1234A) from the bill or document.");
    const who = req.ip ?? "unknown";
    if (attemptsLeft(who) === 0) throw new AppError(429, "Too many wrong codes from this connection. Please try again in an hour.");
    const found = await lookupCode(code);
    if (!found) {
      recordWrong(who);
      throw new AppError(404, "This code does not match any bill or document issued by Unique Futsal. It may be fake.");
    }
    res.json(ApiResponseUtil.success(200, "Genuine", found));
  }),
);

// POST /api/verify/issue {title, details?}: a signed-in customer downloads a PDF (a statement of their bookings, games or
// payments). Each download gets its own verification number so the PDF can be checked at the Verify Documents page.
verifyRouter.post(
  "/issue",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const b = (req.body ?? {}) as { title?: unknown; details?: unknown };
    const title = String(b.title ?? "").trim().slice(0, 120);
    if (title.length < 3) throw new AppError(400, "A document title is required.");
    const details = String(b.details ?? "").trim().slice(0, 1500) || null;
    const user = await prisma.user.findFirst({ where: { phoneNumber: req.user!.id }, select: { phoneNumber: true, name: true } });
    const issuedBy = `app:${user?.phoneNumber ?? req.user!.id}`;
    const recent = await prisma.docVerification.count({ where: { issuedBy, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent >= 30) throw new AppError(429, "Too many downloads. Please try again later.");
    const doc = await createWithCode({ kind: "document", title, issuedTo: user?.name ?? null, orgType: "other", details, issuedBy });
    res.status(201).json(ApiResponseUtil.success(201, "Verification number issued", { code: doc.code }));
  }),
);
