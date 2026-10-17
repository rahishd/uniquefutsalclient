import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import BookingService from "./booking.service";
import { addDaysKey, currentTime as nowTime, isValidKey, startsAtMs, todayKey, weekdayOfKey } from "../../utils/dates";
import SettingsService from "../settings/settings.service";
import { lastPlayedSlot, nearestHour } from "../../utils/rebook";
import { MAX_ADVANCE_DAYS } from "./booking.checkout";

// Customer-app extras mounted under /api/bookings (declared before the "/:id" routes).
const router = Router();

export const ARRIVAL_LEAD_MS = 60 * 60 * 1000; // the check-in opens 1 hour before kick-off
export const ARRIVAL_GRACE_MS = 30 * 60 * 1000; // and stays open 30 minutes after it starts

// The booking page: free one-hour slots with their price. Only bookable slots are listed (taken and past ones are
// left out), and only dates from today to today + 10 days.
router.get(
  "/slots",
  asyncHandler(async (req, res: Response) => {
    const date = String(req.query.date ?? "");
    if (!isValidKey(date)) throw new AppError(400, "Date must be in YYYY-MM-DD format");
    const today = todayKey();
    if (date < today || date > addDaysKey(today, MAX_ADVANCE_DAYS)) throw new AppError(400, `Bookings open only ${MAX_ADVANCE_DAYS} days in advance.`);
    const [free, pricing, fallback] = await Promise.all([BookingService.getAvailableSlots(date, 1), SettingsService.getHourlyPricing(), SettingsService.getHourlyRate()]);
    const slots = free.map((startTime: string) => {
      const hour = parseInt(startTime.split(":")[0], 10);
      const price = pricing.find((p) => parseInt(p.id.replace("ts-", ""), 10) === hour)?.price ?? fallback;
      return { hour, startTime, endTime: `${String((hour + 1) % 24).padStart(2, "0")}:00`, price };
    });
    // Hours the venue closed, with the reason staff wrote, so the customer sees why a time is missing (past hours are left out).
    const operating = new Set(await SettingsService.getTimeSlots());
    const nowHhmm = date === today ? nowTime(new Date()) : "";
    const blocked = [...(await BookingService.getStaffBlocks(date))]
      .filter(([t]) => operating.has(t) && t > nowHhmm)
      .map(([startTime, reason]) => {
        const hour = parseInt(startTime.split(":")[0], 10);
        return { hour, startTime, endTime: `${String((hour + 1) % 24).padStart(2, "0")}:00`, reason };
      })
      .sort((a, b) => a.hour - b.hour);
    res.json(ApiResponseUtil.success(200, "Free slots", { date, slots, blocked }));
  }),
);

// Quick Rebook: the weekday + hour of the customer's LAST game, offered again on the next such weekday. When that hour is
// taken the open hour nearest to it that day is offered instead (target.hour differs from usual.hour). A weekday with
// nothing open is skipped for the following one inside the booking window.
router.get(
  "/me/rebook",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const today = todayKey();
    const rows = await prisma.booking.findMany({
      where: { userId: req.user!.id, date: { lte: today }, status: { in: ["confirmed", "completed"] }, source: "regular", AND: [{ OR: [{ notes: null }, { NOT: { notes: { contains: "MEMBERSHIP_" } } }] }] },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 6,
      select: { date: true, startTime: true },
    });
    // only games that have already started count as played
    const played = rows.map((b) => ({ date: b.date, hour: parseInt(b.startTime.split(":")[0], 10) })).filter((b) => startsAtMs(b.date, b.hour) <= Date.now());
    const usual = lastPlayedSlot(played);
    if (!usual) return res.json(ApiResponseUtil.success(200, "No game played yet", null));

    for (let i = 0; i <= MAX_ADVANCE_DAYS; i++) {
      const date = addDaysKey(today, i);
      if (weekdayOfKey(date) !== usual.weekday || date <= usual.date) continue; // the next such day, after the one played
      const free = (await BookingService.getAvailableSlots(date, 1)).map((s: string) => parseInt(s.split(":")[0], 10));
      const hour = nearestHour(free, usual.hour);
      if (hour === null) continue;
      const q = await BookingService.quote(date, `${String(hour).padStart(2, "0")}:00`, 1);
      return res.json(ApiResponseUtil.success(200, "Usual slot", { usual, target: { date, hour, available: true, price: q.basePrice } }));
    }
    return res.json(ApiResponseUtil.success(200, "Nothing open on your usual day", { usual, target: { available: false } }));
  }),
);

// "I'm coming": the customer slides to confirm. Staff are alerted (dashboard list; push/SMS come later).
router.post(
  "/:id/arrival",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!b || b.userId !== req.user!.id) throw new AppError(404, "Booking not found");
    if (b.status === "cancelled") throw new AppError(409, "This booking was cancelled");
    const start = startsAtMs(b.date, parseInt(b.startTime.split(":")[0], 10));
    const now = Date.now();
    if (now < start - ARRIVAL_LEAD_MS) throw new AppError(409, "Check-in opens 1 hour before your game");
    if (now > start + ARRIVAL_GRACE_MS) throw new AppError(409, "Check-in has closed for this game");
    const row = await prisma.arrivalCheckin.upsert({ where: { refId: b.id }, update: {}, create: { refId: b.id, userId: req.user!.id } });
    await prisma.booking.update({ where: { id: b.id }, data: { checkedInAt: row.confirmedAt } });
    res.json(ApiResponseUtil.success(200, "The venue knows you are coming", { confirmedAt: row.confirmedAt }));
  }),
);

// Staff: who is on the way
router.get(
  "/arrivals",
  ...adminOnly,
  asyncHandler(async (req, res: Response) => {
    const since = new Date(Date.now() - 6 * 3600 * 1000);
    const rows = await prisma.arrivalCheckin.findMany({ where: { confirmedAt: { gte: since } }, orderBy: { confirmedAt: "desc" } });
    const bookings = await prisma.booking.findMany({ where: { id: { in: rows.map((r) => r.refId) } }, select: { id: true, date: true, startTime: true, customerName: true, customerPhone: true } });
    const byId = new Map(bookings.map((b) => [b.id, b]));
    res.json(ApiResponseUtil.success(200, "Arrivals", rows.map((r) => ({ ...r, booking: byId.get(r.refId) ?? null }))));
  }),
);

// Staff: record goals and assists for the players of a game that has been played. Only new games get stats; old games
// stay as they are. Each phone must be a registered customer. Sending a player again replaces their numbers.
router.put(
  "/:id/player-stats",
  ...adminOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!b) throw new AppError(404, "Booking not found");
    if (b.status === "cancelled") throw new AppError(409, "This booking was cancelled");
    if (startsAtMs(b.date, parseInt(b.startTime.split(":")[0], 10)) > Date.now()) throw new AppError(409, "The game has not started yet");
    const stats = req.body?.stats;
    if (!Array.isArray(stats) || stats.length === 0 || stats.length > 30) throw new AppError(400, "Send 1 to 30 players");
    const clean = new Map<string, { goals: number; assists: number }>();
    for (const s of stats) {
      const goals = Number(s?.goals ?? 0);
      const assists = Number(s?.assists ?? 0);
      if (typeof s?.phone !== "string" || !Number.isInteger(goals) || !Number.isInteger(assists) || goals < 0 || assists < 0 || goals > 50 || assists > 50) {
        throw new AppError(400, "Each player needs a phone number and whole-number goals and assists (0 to 50)");
      }
      clean.set(s.phone, { goals, assists });
    }
    const users = await prisma.user.findMany({ where: { phoneNumber: { in: [...clean.keys()] } }, select: { phoneNumber: true } });
    const missing = [...clean.keys()].filter((p) => !users.some((u) => u.phoneNumber === p));
    if (missing.length) throw new AppError(404, `Not a registered player: ${missing.join(", ")}`);
    await prisma.$transaction([...clean.entries()].map(([userId, v]) =>
      prisma.playerGameStat.upsert({ where: { bookingId_userId: { bookingId: b.id, userId } }, update: { ...v, recordedBy: req.user!.id }, create: { bookingId: b.id, userId, ...v, recordedBy: req.user!.id } })));
    res.json(ApiResponseUtil.success(200, "Stats saved", { players: clean.size }));
  }),
);

export default router;
