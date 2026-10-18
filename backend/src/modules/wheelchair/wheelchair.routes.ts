import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import wheelchairService, { DAYS_AHEAD, MAX_PEOPLE, NOTE_MAX, PER_DAY } from "./wheelchair.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

/* ---------- /api/wheelchair ---------- */
export const wheelchairRouter = Router();

// What the form needs (public, so the page can render before sign-in)
wheelchairRouter.get("/options", (_req, res: Response) => ok(res, "Wheelchair request options", { maxPeople: MAX_PEOPLE, noteMax: NOTE_MAX, daysAhead: DAYS_AHEAD, perDay: PER_DAY }));

wheelchairRouter.get("/me", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "My wheelchair requests", await wheelchairService.mine(req.user!.id))));

wheelchairRouter.post(
  "/",
  authMiddleware,
  [body("date").isString(), body("time").isString(), body("people").optional({ values: "null" }).isInt(), body("note").optional({ values: "null" }).isString(), body("bookingCode").optional({ values: "falsy" }).isString()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Request received", await wheelchairService.create(req.user!.id, req.body), 201)),
);

wheelchairRouter.post("/:id/cancel", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Request cancelled", await wheelchairService.cancel(req.user!.id, req.params.id))));
