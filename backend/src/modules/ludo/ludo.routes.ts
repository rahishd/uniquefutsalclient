import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import service, { rules } from "./ludo.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// per signed-in person, so one customer cannot flood the server (only in production, like the other limits)
const limit = (max: number) => rateLimit({
  windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV !== "production",
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? req.ip ?? "anon", message: { success: false, message: "Too many requests. Wait a moment." },
});

// /api/ludo
export const ludoRouter = Router();
const uid = (req: AuthRequest) => req.user!.id;
const p = (req: AuthRequest, k: string) => String(req.params[k]);

// public: the numbers behind the rules, so the page can explain them before sign-in
ludoRouter.get("/rules", (_req, res: Response) => ok(res, "Unique Ludo rules", rules()));
ludoRouter.get("/leaderboard", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) =>
  ok(res, "Leaderboard", await service.leaderboard({ period: String(req.query.period ?? ""), sort: String(req.query.sort ?? ""), mode: String(req.query.mode ?? "") }))));

ludoRouter.use(authMiddleware);

ludoRouter.get("/me", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Unique Ludo", await service.me(uid(req)))));
ludoRouter.get("/history", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "History", await service.history(uid(req), Number(req.query.limit) || 20, Number(req.query.skip) || 0))));
ludoRouter.get("/stats", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Statistics", await service.stats(uid(req)))));
ludoRouter.get("/friends", asyncHandler(async (req: AuthRequest, res: Response) =>
  ok(res, "Friends", await service.friends(uid(req), req.query.room ? String(req.query.room) : undefined, req.query.q ? String(req.query.q) : undefined))));

// single player
ludoRouter.post("/solo", limit(20), asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Game started", await service.startSolo(uid(req), req.body ?? {}), 201)));

// rooms and invitations
ludoRouter.post("/rooms", limit(20), asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Room created", await service.createRoom(uid(req), req.body ?? {}), 201)));
ludoRouter.post("/rooms/join", limit(30), [body("code").isString().isLength({ min: 6, max: 6 })], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Joined", await service.joinByCode(uid(req), req.body.code))));
ludoRouter.get("/rooms/:id", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Room", await service.getView(uid(req), p(req, "id")))));
ludoRouter.post("/rooms/:id/invite", limit(40), [body("phone").isString()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Invitation sent", await service.invite(uid(req), p(req, "id"), req.body.phone), 201)));
ludoRouter.delete("/rooms/:id/invites/:inviteId", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Invitation cancelled", await service.cancelInvite(uid(req), p(req, "id"), p(req, "inviteId")))));
ludoRouter.post("/rooms/:id/ready", [body("ready").isBoolean()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Updated", await service.setReady(uid(req), p(req, "id"), req.body.ready === true))));
ludoRouter.delete("/rooms/:id/players/:playerId", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Player removed", await service.kick(uid(req), p(req, "id"), p(req, "playerId")))));
ludoRouter.post("/rooms/:id/leave", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Left", await service.leave(uid(req), p(req, "id")))));
ludoRouter.post("/rooms/:id/cancel", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Room cancelled", await service.cancel(uid(req), p(req, "id")))));
ludoRouter.post("/rooms/:id/start", limit(20), asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Game started", await service.start(uid(req), p(req, "id")))));
ludoRouter.post("/invites/:id/accept", limit(30), asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Joined the room", await service.acceptInvite(uid(req), p(req, "id")))));
ludoRouter.post("/invites/:id/decline", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Declined", await service.declineInvite(uid(req), p(req, "id")))));

// playing: the app sends an action and the game's action counter (`seq`), never a result
ludoRouter.get("/games/:id", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Game", await service.getView(uid(req), p(req, "id")))));
ludoRouter.post("/games/:id/roll", limit(120), [body("seq").isInt({ min: 0 }).toInt()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Rolled", await service.roll(uid(req), p(req, "id"), req.body.seq))));
ludoRouter.post("/games/:id/move", limit(120), [body("seq").isInt({ min: 0 }).toInt(), body("token").isInt({ min: 0, max: 3 }).toInt()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Moved", await service.move(uid(req), p(req, "id"), req.body.token, req.body.seq))));
ludoRouter.post("/games/:id/leave", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Left the game", await service.leave(uid(req), p(req, "id")))));
