import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import healthService from "./health.service";

const ok = (res: Response, message: string, data?: unknown) => res.status(200).json(ApiResponseUtil.success(200, message, data));

/* ---------- /api/wellness (signed-in customers only) ---------- */
export const healthRouter = Router();
healthRouter.use(authMiddleware);

healthRouter.get("/me", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "My health", await healthService.me(req.user!.id, Number(req.query.days)))));
healthRouter.put("/log", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Check-in saved", await healthService.saveLog(req.user!.id, req.body ?? {}))));
healthRouter.put("/plan", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Plan saved", await healthService.savePlan(req.user!.id, req.body ?? {}))));
