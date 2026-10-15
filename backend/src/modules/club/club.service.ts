import { randomInt } from "crypto";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import paymentService from "../payment/payment.service";
import notificationService from "../notification/notification.service";

// Unique Club: Rs. 1,500 for 30 days. While a member is active every court booking and Gamezone session gets 10% off
// (it replaces promo and VIP codes, which are not used with it). The server decides everything; the app only shows it.
export const CLUB_FEE = 1500;
export const CLUB_DAYS = 30;
export const CLUB_PERCENT = 10;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** The member's record while the club is active, else null. Guests (no account) are never members. */
export async function activeClub(userId?: string | null) {
  if (!userId) return null;
  const m = await prisma.clubMember.findUnique({ where: { userId } });
  return m && m.validUntil.getTime() > Date.now() ? m : null;
}

// The membership-plan and tournament-hosting discounts are for members who have been in the club for 15 days, or who have
// played 5 games since they joined (court bookings and Gamezone get the 10% from day one).
export const MATURE_DAYS = 15;
export const MATURE_GAMES = 5;

export async function clubMaturity(userId: string, at: Date = new Date()) {
  const m = await prisma.clubMember.findUnique({ where: { userId } });
  const active = !!m && m.validUntil.getTime() > at.getTime();
  if (!m) return { active: false, mature: false, daysIn: 0, games: 0, daysLeft: MATURE_DAYS, gamesLeft: MATURE_GAMES };
  const daysIn = Math.max(0, Math.floor((at.getTime() - m.startedAt.getTime()) / DAY_MS));
  const since = m.startedAt.toISOString().slice(0, 10);
  const games = await prisma.booking.count({ where: { userId, status: "completed", date: { gte: since } } });
  const mature = active && (daysIn >= MATURE_DAYS || games >= MATURE_GAMES);
  return { active, mature, daysIn, games, daysLeft: Math.max(MATURE_DAYS - daysIn, 0), gamesLeft: Math.max(MATURE_GAMES - games, 0) };
}

/** 10% of an amount, in whole rupees. */
export const clubDiscountOf = (amount: number) => Math.round((amount * CLUB_PERCENT) / 100);

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "CLUB-" + Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export class ClubService {
  async status(userId: string) {
    const m = await prisma.clubMember.findUnique({ where: { userId } });
    const active = !!m && m.validUntil.getTime() > Date.now();
    const mat = await clubMaturity(userId);
    return {
      fee: CLUB_FEE,
      days: CLUB_DAYS,
      percent: CLUB_PERCENT,
      member: active,
      expired: !!m && !active,
      validUntil: m?.validUntil ?? null,
      daysLeft: active ? Math.max(Math.ceil((m!.validUntil.getTime() - Date.now()) / DAY_MS), 0) : 0,
      since: m?.startedAt ?? null,
      payments: m?.payments ?? 0,
      // membership plan and tournament hosting: unlocked after 15 days in the club, or 5 games played since joining
      matureAfterDays: MATURE_DAYS,
      matureAfterGames: MATURE_GAMES,
      mature: mat.mature,
      daysIn: mat.daysIn,
      gamesPlayed: mat.games,
      daysToMature: mat.mature ? 0 : mat.daysLeft,
      gamesToMature: mat.mature ? 0 : mat.gamesLeft,
    };
  }

  /** Starts the Rs. 1,500 payment (Fonepay QR). Active at once when the payment arrives; renewing adds 30 days. */
  async join(userId: string) {
    const pending = await prisma.paymentOrder.findFirst({
      where: { userId, purpose: "club", status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (pending) return paymentService.publicView(pending);

    let orderCode = makeCode();
    for (let i = 0; i < 5 && (await prisma.paymentOrder.findUnique({ where: { orderCode }, select: { id: true } })); i++) orderCode = makeCode();
    return paymentService.createOrder({ orderCode, purpose: "club", userId, method: "fonepay", amount: CLUB_FEE });
  }

  /** Called when the Rs. 1,500 payment is confirmed (once per order, see PaymentService.markPaid). */
  async activate(userId: string, orderCode: string) {
    const now = Date.now();
    const cur = await prisma.clubMember.findUnique({ where: { userId } });
    // renewing early adds on top of the days that are left
    const from = cur && cur.validUntil.getTime() > now ? cur.validUntil.getTime() : now;
    const validUntil = new Date(from + CLUB_DAYS * DAY_MS);
    await prisma.clubMember.upsert({
      where: { userId },
      create: { userId, validUntil },
      update: { validUntil, lastPaidAt: new Date(), payments: { increment: 1 } },
    });
    await notificationService.notify({
      userId,
      type: "membership",
      title: cur ? "Unique Club renewed" : "Welcome to Unique Club",
      message: `You get ${CLUB_PERCENT}% off bookings and Gamezone until ${validUntil.toISOString().slice(0, 10)}.`,
      href: "/club",
      dedupeKey: `club-active-${orderCode}`,
    });
  }

  /** Job: a reminder 3 days before the club ends, once per period. */
  async remindExpiring(): Promise<number> {
    const soon = new Date(Date.now() + 3 * DAY_MS);
    const rows = await prisma.clubMember.findMany({ where: { validUntil: { gt: new Date(), lte: soon } }, take: 500 });
    let n = 0;
    for (const m of rows) {
      await notificationService.notify({
        userId: m.userId,
        type: "membership",
        title: "Unique Club ends soon",
        message: `Your club discount ends on ${m.validUntil.toISOString().slice(0, 10)}. Renew for Rs. ${CLUB_FEE} to keep ${CLUB_PERCENT}% off.`,
        href: "/club",
        dedupeKey: `club-remind-${m.userId}-${m.validUntil.toISOString().slice(0, 10)}`,
      });
      n++;
    }
    return n;
  }

  async assertCanJoin(userId: string) {
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { phoneNumber: true } });
    if (!user) throw new AppError(401, "Sign in to join Unique Club.");
  }
}

export default new ClubService();
