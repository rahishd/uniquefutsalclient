import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import service, { rules } from "./watchearn.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// A safety net against scripts (only in production, like the other limits)
const limit = (max: number) => rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV !== "production", message: { success: false, message: "Too many requests. Wait a moment." } });

// /api/watch-earn
export const watchEarnRouter = Router();

// public: the rules, so the page can explain them before sign-in
watchEarnRouter.get("/rules", (_req, res: Response) => ok(res, "Watch & Earn rules", rules()));

watchEarnRouter.use(authMiddleware);

watchEarnRouter.get("/me", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Watch & Earn", await service.me(req.user!.id))));

watchEarnRouter.post(
  "/views",
  limit(30),
  [body("adId").optional({ nullable: true }).isString().isLength({ max: 64 })],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Ad started", await service.start(req.user!.id, req.body?.adId), 201)),
);

watchEarnRouter.post("/views/:id/complete", limit(30), asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Ad counted", await service.complete(req.user!.id, req.params.id))));
