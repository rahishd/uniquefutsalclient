import { Response } from "express";
import { randomBytes } from "crypto";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import { addDaysKey, todayKey } from "../../utils/dates";
import BookingService from "./booking.service";
import paymentService, { QR_HOLD_MS } from "../payment/payment.service";
import notificationService from "../notification/notification.service";
import SettingsService from "../settings/settings.service";
import { usesLeft } from "../promo/promoLimits";

// Bulk Booking (customer app): up to 10 one-hour games in the next 7 days, booked and paid together.
//  - registered customers only, paid ONLY online with Fonepay, either 50% now (the rest at the venue) or in full;
//  - the promo code is tried on every slot on its own and applies only to the slots it is valid for;
//  - every hour is a normal booking (so staff, reminders, cancel and loyalty work as always), tied together by a BULK tag;
//  - one payment order covers them all. Unpaid, they are all released together when the QR hold runs out.
export const BULK_MAX_HOURS = 10;
export const BULK_WINDOW_DAYS = 7;
export const BULK_MAX_PER_WEEK = 5; // bulk-booked games one customer can hold in one calendar week (Monday to Sunday)
export const BULK_ADVANCE_PERCENT = 50;
export const BULK_TAG = "BULK:";

type Slot = { date: string; startTime: string };
type Mode = "advance" | "full";

const TIME = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function cleanSlots(raw: unknown): Slot[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new AppError(400, "Pick at least one hour.");
  if (raw.length > BULK_MAX_HOURS) throw new AppError(400, `A bulk booking is up to ${BULK_MAX_HOURS} hours.`);
  const today = todayKey();
  const last = addDaysKey(today, BULK_WINDOW_DAYS);
  const seen = new Set<string>();
  return raw.map((s) => {
    const date = String((s as Slot)?.date ?? "");
    const startTime = String((s as Slot)?.startTime ?? "");
    if (!DAY.test(date) || !TIME.test(startTime)) throw new AppError(400, "A slot has an invalid date or time.");
    if (date < today) throw new AppError(400, "Cannot book a slot in the past");
    if (date > last) throw new AppError(400, `Bulk booking is for the next ${BULK_WINDOW_DAYS} days only.`);
    const key = `${date} ${startTime}`;
    if (seen.has(key)) throw new AppError(400, "The same hour was picked twice.");
    seen.add(key);
    return { date, startTime };
  }).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

// The Monday of the week a date (YYYY-MM-DD) falls in.
export function weekStartOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysKey(date, -((day + 6) % 7));
}

// Bulk games (not cancelled) this customer already holds, by the week they are played in.
async function weeklyUsed(userId: string): Promise<Record<string, number>> {
  const today = todayKey();
  const from = weekStartOf(today);
  const to = addDaysKey(weekStartOf(addDaysKey(today, BULK_WINDOW_DAYS)), 6);
  const rows = await prisma.booking.findMany({ where: { userId, date: { gte: from, lte: to }, status: { not: "cancelled" }, notes: { contains: BULK_TAG } }, select: { date: true } });
  const used: Record<string, number> = {};
  for (const r of rows) { const w = weekStartOf(r.date); used[w] = (used[w] ?? 0) + 1; }
  return used;
}

// At most BULK_MAX_PER_WEEK bulk games per customer per week: what they already hold plus what they pick now.
async function assertWeeklyLimit(userId: string, slots: Slot[]) {
  const used = await weeklyUsed(userId);
  const picked: Record<string, number> = {};
  for (const s of slots) { const w = weekStartOf(s.date); picked[w] = (picked[w] ?? 0) + 1; }
  for (const [w, n] of Object.entries(picked)) {
    const have = used[w] ?? 0;
    if (have + n > BULK_MAX_PER_WEEK) {
      const room = Math.max(0, BULK_MAX_PER_WEEK - have);
      throw new AppError(409, `You can bulk-book up to ${BULK_MAX_PER_WEEK} games a week. For the week starting ${w} you already have ${have}, so you can add ${room} more.`);
    }
  }
}

const registeredId = (req: AuthRequest) => {
  if (!req.user || req.user.role !== "user") throw new AppError(401, "Sign in to make a bulk booking.");
  return req.user.id;
};

const modeOf = (raw: unknown): Mode => {
  if (raw === "advance" || raw === "full") return raw;
  throw new AppError(400, `Choose ${BULK_ADVANCE_PERCENT}% advance or the full amount.`);
};

export const amountFor = (total: number, mode: Mode) => (mode === "full" ? total : Math.round((total * BULK_ADVANCE_PERCENT) / 100));

// The public promo codes that would save this customer money on the picked hours, best first. Each code is tried on every hour on its own
// (so only the hours it is valid for count), and a code with few uses left only counts for that many hours, the earliest ones, which is how
// the booking itself will apply it. A Unique Club member gets 10% off instead of a promo, so they are shown none.
const MAX_SUGGESTIONS = 3;
async function bestPromos(slots: Slot[], userId: string) {
  const all = (await SettingsService.getPromoCodes()).filter((p) => p.isActive !== false && (p.appliedTo === "booking" || p.appliedTo === "both"));
  const out: { code: string; label: string; discount: number; total: number; hours: number }[] = [];
  await Promise.all(all.slice(0, 15).map(async (p) => {
    const left = await usesLeft(p, userId);
    if (left === 0) return;
    let hours = 0;
    let discount = 0;
    let total = 0;
    for (const s of slots) {
      const q = await BookingService.quote(s.date, s.startTime, 1, p.code, userId);
      if (q.promo?.ok && q.discount > 0 && (left === null || hours < left)) { hours++; discount += q.discount; total += q.total; } else total += q.basePrice;
    }
    if (discount > 0) out.push({ code: p.code, label: p.title || p.label || p.code, discount, total, hours });
  }));
  return out.sort((a, b) => b.discount - a.discount || a.code.localeCompare(b.code)).slice(0, MAX_SUGGESTIONS);
}

const newCode = () => `BLK-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;

export const bulkController = {
  // How many bulk games this customer already holds in each week, so the app can stop picking at the limit.
  allowance: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = registeredId(req);
    res.json(ApiResponseUtil.success(200, "Bulk allowance", { limit: BULK_MAX_PER_WEEK, used: await weeklyUsed(userId) }));
  }),

  // Price preview for every picked hour (no side effects). A promo is applied only to the hours it is valid for.
  quote: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = registeredId(req);
    const slots = cleanSlots(req.body.slots);
    await assertWeeklyLimit(userId, slots);
    const promoCode = typeof req.body.promoCode === "string" ? req.body.promoCode.trim() : "";
    let promoNote: string | null = null;
    let anyPromo = false;
    const rows = [];
    for (const s of slots) {
      const q = await BookingService.quote(s.date, s.startTime, 1, promoCode || undefined, userId);
      if (promoCode) {
        if (q.promo?.ok) anyPromo = true;
        else if (q.promo?.message) promoNote = q.promo.message;
      }
      rows.push({ ...s, basePrice: q.basePrice, discount: q.discount, total: q.total, promoApplied: Boolean(promoCode && q.promo?.ok) });
    }
    const subtotal = rows.reduce((n, r) => n + r.basePrice, 0);
    const discount = rows.reduce((n, r) => n + r.discount, 0);
    const total = rows.reduce((n, r) => n + r.total, 0);
    const suggestions = await bestPromos(slots, userId);
    res.json(
      ApiResponseUtil.success(200, "Bulk quote", {
        slots: rows,
        subtotal,
        discount,
        total,
        advance: amountFor(total, "advance"),
        advancePercent: BULK_ADVANCE_PERCENT,
        suggestions: suggestions.map((s, i) => ({ ...s, best: i === 0 })),
        promo: promoCode ? { code: promoCode.toUpperCase(), ok: anyPromo, appliedTo: rows.filter((r) => r.promoApplied).length, message: anyPromo ? null : promoNote ?? "This promo code cannot be used for these hours." } : null,
      }),
    );
  }),

  // Holds every hour and makes ONE Fonepay QR for the advance or the full amount.
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = registeredId(req);
    const slots = cleanSlots(req.body.slots);
    await assertWeeklyLimit(userId, slots);
    const mode = modeOf(req.body.mode);
    const promoCode = typeof req.body.promoCode === "string" && req.body.promoCode.trim() ? req.body.promoCode.trim() : undefined;
    if (req.body.method !== undefined && req.body.method !== "fonepay") throw new AppError(403, "Bulk bookings are paid online with Fonepay only.");

    const code = newCode();
    const holdUntil = new Date(Date.now() + QR_HOLD_MS);
    const made: { id: string; total: number }[] = [];

    const undo = async () => {
      for (const b of made) {
        await prisma.booking.update({ where: { id: b.id }, data: { status: "cancelled", cancelledAt: new Date(), notes: `${BULK_TAG}${code} | CHECKOUT_FAILED` } });
        await BookingService.freeSlots(b.id);
      }
    };

    try {
      for (const s of slots) {
        // the promo goes only on the hours where it is valid (checked on its own for each hour)
        let usePromo: string | undefined;
        if (promoCode) {
          const q = await BookingService.quote(s.date, s.startTime, 1, promoCode, userId);
          if (q.promo?.ok) usePromo = promoCode;
        }
        let booking;
        try {
          booking = await BookingService.createBooking({ date: s.date, startTime: s.startTime, duration: 1, promoCode: usePromo, paymentMethod: "full" }, userId);
        } catch (e) {
          // a per-customer promo limit reached part-way through: this hour is simply booked at the normal price
          if (usePromo && e instanceof AppError && e.statusCode === 400 && /promo|code/i.test(e.message)) {
            booking = await BookingService.createBooking({ date: s.date, startTime: s.startTime, duration: 1, paymentMethod: "full" }, userId);
          } else {
            throw e;
          }
        }
        made.push({ id: booking.id, total: booking.totalPrice });
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "pending", paymentStatus: "pending", holdExpiresAt: holdUntil, paymentOrderCode: code, notes: `${BULK_TAG}${code}` },
        });
      }

      const total = made.reduce((n, b) => n + b.total, 0);
      if (total <= 0) throw new AppError(400, "These hours cost nothing to pay. Book them one by one.");
      const amount = amountFor(total, mode);
      const payment = await paymentService.createOrder({ orderCode: code, purpose: "bulk", userId, method: "fonepay", amount });

      await notificationService.notify({
        userId, type: "booking", title: "Bulk booking created",
        message: `${made.length} ${made.length === 1 ? "hour is" : "hours are"} held for you. Pay Rs. ${amount} with Fonepay to confirm. Code ${code}.`,
        href: "/profile", dedupeKey: `bulk-created-${code}`,
      });

      res.status(201).json(ApiResponseUtil.success(201, "Bulk booking created", { code, mode, total, payNow: amount, restAtVenue: total - amount, bookings: made.map((b) => b.id), payment }));
    } catch (err) {
      await undo();
      throw err;
    }
  }),
};

export default bulkController;
