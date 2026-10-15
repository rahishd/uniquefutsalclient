import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import chatService, { BODY_MAX, GROUP_MAX_MEMBERS, GROUP_NAME_MAX, GROUP_NAME_MIN } from "./chat.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

// /api/chat: every route needs a signed-in customer
export const chatRouter = Router();
chatRouter.use(authMiddleware);

chatRouter.get("/rules", (_req, res: Response) => {
  ok(res, "Chat rules", { bodyMax: BODY_MAX, groupMax: GROUP_MAX_MEMBERS, groupNameMin: GROUP_NAME_MIN, groupNameMax: GROUP_NAME_MAX });
});

chatRouter.get("/people", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "People", await chatService.people(req.user!.id, req.query.q));
}));

chatRouter.get("/unread", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Unread", { unread: await chatService.unreadTotal(req.user!.id) });
}));

chatRouter.get("/threads", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Chats", await chatService.threads(req.user!.id));
}));

chatRouter.post("/direct", [body("phone").isString()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Chat opened", await chatService.openDirect(req.user!.id, req.body.phone));
}));

chatRouter.post(
  "/groups",
  [body("name").isString(), body("members").optional({ values: "null" }).isArray()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    ok(res, "Group created", await chatService.createGroup(req.user!.id, req.body), 201);
  }),
);

// invite links (declared before /:id routes)
chatRouter.get("/invite/:code", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Invite", await chatService.invitePreview(req.user!.id, req.params.code));
}));
chatRouter.post("/invite/:code/join", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Joined", await chatService.join(req.user!.id, req.params.code));
}));

chatRouter.get("/threads/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Chat", await chatService.thread(req.user!.id, req.params.id));
}));

chatRouter.get("/threads/:id/messages", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Messages", await chatService.messages(req.user!.id, req.params.id, req.query.after));
}));

chatRouter.post("/threads/:id/messages", [body("body").isString()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Sent", await chatService.send(req.user!.id, req.params.id, req.body.body), 201);
}));

chatRouter.patch("/threads/:id", [body("name").isString()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Group renamed", await chatService.rename(req.user!.id, req.params.id, req.body.name));
}));

chatRouter.post("/threads/:id/members", [body("phones").isArray()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "People added", await chatService.addMembers(req.user!.id, req.params.id, req.body.phones));
}));

chatRouter.delete("/threads/:id/members/:phone", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Removed", await chatService.removeMember(req.user!.id, req.params.id, req.params.phone));
}));

chatRouter.post("/threads/:id/invite", asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "New invite link", await chatService.resetInvite(req.user!.id, req.params.id));
}));
