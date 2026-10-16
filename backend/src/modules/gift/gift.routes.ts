import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import giftService from "./gift.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// /api/gifts: Gift Card, for a signed-in customer (staff accounts cannot send gifts)
export const giftRouter = Router();
giftRouter.get("/rules", (_req, res) => ok(res, "Gift Card rules", giftService.rules()));
giftRouter.use(authMiddleware);
giftRouter.use((req: AuthRequest, _res, next) => next(req.user?.role === "user" ? undefined : new AppError(403, "Gift cards are for customers")));

giftRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "My gifts", await giftService.mine(req.user!.id))));
giftRouter.get("/friend/:phone", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Friend", await giftService.friend(req.user!.id, req.params.phone))));
// Pay with the QR, then poll /payments/:orderCode/status. The points or the game reach the friend once it is paid.
giftRouter.post("/points", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Gift payment", await giftService.buyPoints(req.user!.id, req.body ?? {}), 201)));
giftRouter.post("/game/quote", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Gift game price", await giftService.quoteGame(req.user!.id, req.body ?? {}))));
giftRouter.post("/game", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Gift game booked", await giftService.bookGame(req.user!.id, req.body ?? {}), 201)));
