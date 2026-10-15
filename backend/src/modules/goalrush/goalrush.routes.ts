import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import service, { SHOTS_PER_GAME, rules } from "./goalrush.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// A safety net against scripts (only in production, like the other limits)
const limit = (max: number) => rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV !== "production", message: { success: false, message: "Too many requests. Wait a moment." } });

// /api/goal-rush
export const goalRushRouter = Router();

// public: the rules, so the page can explain them before sign-in
goalRushRouter.get("/rules", (_req, res: Response) => ok(res, "Goal Rush rules", rules()));

goalRushRouter.use(authMiddleware);

goalRushRouter.get("/me", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Goal Rush", await service.me(req.user!.id))));
goalRushRouter.get("/history", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Goal Rush history", await service.history(req.user!.id, Number(req.query.limit) || 20))));

goalRushRouter.post("/games", limit(30), asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await service.start(req.user!.id);
  ok(res, r.resumed ? "Game resumed" : "Game started", r, r.resumed ? 200 : 201);
}));

goalRushRouter.get("/games/:id", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Game", await service.game(req.user!.id, req.params.id))));

goalRushRouter.post(
  "/games/:id/shots",
  limit(120),
  [
    body("no").isInt({ min: 1, max: SHOTS_PER_GAME }).withMessage(`Shot number must be 1 to ${SHOTS_PER_GAME}`).toInt(),
    body("aimX").isFloat({ min: -5, max: 5 }).toFloat(),
    body("aimY").isFloat({ min: -5, max: 5 }).toFloat(),
    body("power").isFloat({ min: 0, max: 1 }).toFloat(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Shot", await service.shoot(req.user!.id, req.params.id, req.body))),
);
