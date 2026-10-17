import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import evService from "./ev.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// /api/ev: every route needs a signed-in customer
export const evRouter = Router();
evRouter.use(authMiddleware);

evRouter.get("/me", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "EV charging", await evService.me(req.user!.id));
}));

evRouter.post("/start", [body("code").isString()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Charging started", await evService.start(req.user!.id, req.body.code), 201);
}));

evRouter.post("/:id/stop", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Charging stopped", await evService.stop(req.user!.id, req.params.id));
}));
