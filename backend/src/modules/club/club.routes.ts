import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import clubService from "./club.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// /api/club: a signed-in customer
export const clubRouter = Router();
clubRouter.use(authMiddleware);

clubRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Unique Club", await clubService.status(req.user!.id))));

// Pay Rs. 1,500 with the Fonepay QR. Poll /payments/:orderCode/status; the club switches on when it is paid.
clubRouter.post("/join", asyncHandler(async (req: AuthRequest, res: Response) => {
  await clubService.assertCanJoin(req.user!.id);
  ok(res, "Club payment", await clubService.join(req.user!.id));
}));
