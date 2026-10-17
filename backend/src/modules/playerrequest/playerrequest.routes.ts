import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import SettingsService from "../settings/settings.service";
import { AGE_GROUPS } from "../../utils/age";
import service, { ADVANCE_FEE, MAX_PLAYERS, NOTE_MAX, PER_DAY, WINDOW_DAYS } from "./playerrequest.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// /api/player-requests: every route needs a signed-in customer
export const playerRequestRouter = Router();
playerRequestRouter.use(authMiddleware);

playerRequestRouter.get("/rules", asyncHandler(async (_req: AuthRequest, res: Response) => {
  // the hours a game can start at are the venue's open hours
  const hours = (await SettingsService.getTimeSlots()).map((t) => parseInt(t, 10)).filter((h) => Number.isInteger(h));
  ok(res, "Find Player rules", { maxPlayers: MAX_PLAYERS, windowDays: WINDOW_DAYS, advanceFee: ADVANCE_FEE, perDay: PER_DAY, noteMax: NOTE_MAX, hours, ageGroups: AGE_GROUPS });
}));

playerRequestRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Requests", await service.list(req.user!.id))));

playerRequestRouter.post(
  "/",
  [body("date").isString(), body("hour").isInt({ min: 0, max: 23 }).toInt(), body("players").isInt({ min: 1, max: MAX_PLAYERS }).toInt(), body("note").optional({ values: "null" }).isString(), body("ageGroup").optional({ values: "null" }).isString()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Request posted", await service.create(req.user!.id, req.body), 201)),
);

playerRequestRouter.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Request", await service.detail(req.user!.id, req.params.id))));
playerRequestRouter.post("/:id/join", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Joined", await service.join(req.user!.id, req.params.id))));
playerRequestRouter.post("/:id/leave", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Left", await service.leave(req.user!.id, req.params.id))));
playerRequestRouter.post("/:id/advance", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Advance payment", await service.advance(req.user!.id, req.params.id))));
playerRequestRouter.post("/:id/cancel", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Cancelled", await service.cancel(req.user!.id, req.params.id))));
