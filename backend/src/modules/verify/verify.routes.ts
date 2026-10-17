import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import { attemptsLeft, lookupCode, recordWrong } from "./verify.service";

// POST /api/verify {code}: public, no sign-in. Is this code on a bill or document genuine, and what does it cover?
// The code goes in the body, not the address, so it does not end up in logs. A wrong code is a 404 ("fake").
export const verifyRouter = Router();

verifyRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const code = String((req.body as { code?: unknown })?.code ?? "").replace(/\s+/g, "");
    if (!/^\d{4,6}$/.test(code)) throw new AppError(400, "Enter the 4-digit verification code from the bill or document.");
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
