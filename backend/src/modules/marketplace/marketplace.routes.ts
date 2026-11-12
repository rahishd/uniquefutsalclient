import { Router, Response, Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import marketplaceService from "./marketplace.service";

const router = Router();

// The partners and their offers that are live today (public: the Home tile and the banners need it before sign-in).
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  res.json(ApiResponseUtil.success(200, "Partners retrieved", await marketplaceService.list()));
}));

// My cards (what I redeemed) and my loyalty card (balance and the latest points I earned)
router.get("/cards", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(ApiResponseUtil.success(200, "Cards retrieved", await marketplaceService.cards(req.user!.id)));
}));
router.get("/loyalty-card", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(ApiResponseUtil.success(200, "Loyalty card retrieved", await marketplaceService.loyaltyCard(req.user!.id)));
}));

// Spend points on an offer and get the card
router.post("/offers/:id/redeem", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json(ApiResponseUtil.success(201, "Card ready", await marketplaceService.redeem(req.user!.id, String(req.params.id))));
}));

export default router;
