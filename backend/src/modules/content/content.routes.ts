import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import contentService from "./content.service";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";
import { clientIp, parseDevice, placeOf } from "../../utils/visitInfo";

/* ---------- /api/content (public: no sign-in needed to see gallery and ads) ---------- */
export const contentRouter = Router();

contentRouter.get("/active", asyncHandler(async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  res.json(ApiResponseUtil.success(200, "Site content", await contentService.active()));
}));

// A picture is never edited in place (a replacement gets a new id), so it can be cached for a year.
contentRouter.get("/media/:id", asyncHandler(async (req: Request, res: Response) => {
  const m = await contentService.media(req.params.id);
  res.set({ "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "cross-origin" });
  res.send(Buffer.from(m.data));
}));

contentRouter.post("/ads/:id/view", asyncHandler(async (req: Request, res: Response) => {
  await contentService.count(req.params.id, "impressions");
  res.status(204).end();
}));

contentRouter.post("/ads/:id/click", asyncHandler(async (req: Request, res: Response) => {
  await contentService.count(req.params.id, "clicks");
  res.status(204).end();
}));

// "Website visits" for the venue. The browser sends a random id it made for itself once per page view. The server adds what the request
// itself shows (IP address, roughly where, device type and name) and, when the person is signed in, which account it is.
// Counted once per visitor per Nepal day, with how many pages they opened. Bad ids are ignored; it always answers 204 straight away.
const VISITOR = /^[A-Za-z0-9_-]{16,64}$/;
contentRouter.post("/visit", optionalAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const visitor = String((req.body as { visitor?: unknown })?.visitor ?? "");
  res.status(204).end();
  if (!VISITOR.test(visitor)) return;
  try {
    const day = todayKey();
    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? null;
    const registered = Boolean(userId);
    const where = { day_visitor: { day, visitor } };
    // a row made before the details existed (or while they could not be read) gets them from the next page view
    let existing: { id: string; ip?: string | null; deviceType?: string | null } | null;
    let canHoldDetails = true;
    try { existing = await prisma.siteVisit.findUnique({ where, select: { id: true, ip: true, deviceType: true } }); }
    catch { canHoldDetails = false; existing = await prisma.siteVisit.findUnique({ where, select: { id: true } }); }
    if (existing) {
      const missing = canHoldDetails && !existing.ip && !existing.deviceType;
      const found = missing ? { ip: clientIp(req), ...parseDevice(req.headers["user-agent"]) } : {};
      const place = missing ? await placeOf(req, (found as { ip: string | null }).ip) : {};
      const bump = { pages: { increment: 1 }, lastAt: new Date(), ...(registered ? { registered: true, ...(canHoldDetails ? { userId } : {}) } : {}), ...found, ...place };
      await prisma.siteVisit.update({ where, data: bump, select: { id: true } }).catch(() => prisma.siteVisit.update({ where, data: { pages: { increment: 1 }, lastAt: new Date(), ...(registered ? { registered: true } : {}) }, select: { id: true } }));
      return;
    }
    const ip = clientIp(req);
    const place = await placeOf(req, ip);
    const device = parseDevice(req.headers["user-agent"]);
    await prisma.siteVisit
      .create({ data: { day, visitor, registered, userId, ip, ...place, ...device }, select: { id: true } })
      .catch(async () => {
        // two page views at once (the second just counts), or the visitor-details columns are not in the database yet: keep the plain count
        if (await prisma.siteVisit.findUnique({ where, select: { id: true } })) return prisma.siteVisit.update({ where, data: { pages: { increment: 1 }, lastAt: new Date() }, select: { id: true } });
        return prisma.siteVisit.create({ data: { day, visitor, registered }, select: { id: true } });
      });
  } catch { /* a counter must never break the page */ }
}));
