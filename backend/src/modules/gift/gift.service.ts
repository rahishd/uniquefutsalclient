import { randomInt } from "crypto";
import { Gift } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import BookingService from "../booking/booking.service";
import { assertWindow } from "../booking/booking.checkout";
import paymentService, { QR_HOLD_MS } from "../payment/payment.service";
import loyaltyService from "../loyalty/loyalty.service";
import notificationService from "../notification/notification.service";

// Gift Card: a signed-in customer gives a registered friend
//   - loyalty points, bought at Rs. 10 a point (paid with the Fonepay QR; the points land on the friend when it is paid), or
//   - a game: a 1-hour court booking made on the FRIEND's account, paid in full online by the buyer.
// The server decides the price, checks the friend, and only delivers once the payment is confirmed.
export const RS_PER_POINT = 10;
export const MIN_POINTS = 10;
export const MAX_POINTS = 500;
export const PER_DAY = 5; // gifts one customer can start in 24 hours
const PHONE = /^9\d{9}$/;
export const GIFT_TAG = "GIFT_FROM:";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "GIFT-" + Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const firstName = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] || "Player";

function cleanMessage(m: unknown) {
  if (m === undefined || m === null || m === "") return null;
  if (typeof m !== "string") throw new AppError(400, "Invalid message");
  const t = m.trim();
  if (t.length > 120) throw new AppError(400, "Keep the message under 120 characters");
  return t || null;
}

export class GiftService {
  rules() {
    return { rsPerPoint: RS_PER_POINT, minPoints: MIN_POINTS, maxPoints: MAX_POINTS, perDay: PER_DAY };
  }

  /** The friend must be another registered customer. Returns only their first name, to check it is the right person. */
  async friend(buyerId: string, phone: unknown) {
    const p = typeof phone === "string" ? phone.trim() : "";
    if (!PHONE.test(p)) throw new AppError(400, "Enter your friend's 10-digit mobile number starting with 9");
    if (p === buyerId) throw new AppError(400, "Choose a friend, not yourself");
    const u = await prisma.user.findUnique({ where: { phoneNumber: p }, select: { phoneNumber: true, name: true, isActive: true, role: true } });
    if (!u || !u.isActive || u.role !== "user") throw new AppError(404, "No account with this number. Your friend needs to register in the app first.");
    return { phone: u.phoneNumber, firstName: firstName(u.name) };
  }

  private async assertDaily(buyerId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.gift.count({ where: { buyerId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can send up to ${PER_DAY} gifts a day. Please try again tomorrow.`);
    }
  }

  private async newCode() {
    let code = makeCode();
    for (let i = 0; i < 5 && (await prisma.gift.findUnique({ where: { code }, select: { id: true } })); i++) code = makeCode();
    return code;
  }

  private slot(input: { date?: unknown; startTime?: unknown }) {
    const date = typeof input.date === "string" ? input.date : "";
    const startTime = typeof input.startTime === "string" ? input.startTime : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:00$/.test(startTime)) throw new AppError(400, "Choose a date and a time.");
    assertWindow(date);
    return { date, startTime };
  }

  /** Buy loyalty points for a friend: Rs. 10 a point, whole points between 10 and 500. */
  async buyPoints(buyerId: string, input: { friendPhone?: unknown; points?: unknown; message?: unknown }) {
    const f = await this.friend(buyerId, input.friendPhone);
    const points = Number(input.points);
    if (!Number.isInteger(points) || points < MIN_POINTS || points > MAX_POINTS) {
      throw new AppError(400, `Choose between ${MIN_POINTS} and ${MAX_POINTS} points`);
    }
    const message = cleanMessage(input.message);
    await this.assertDaily(buyerId);
    const code = await this.newCode();
    const amount = points * RS_PER_POINT;
    const gift = await prisma.gift.create({ data: { code, kind: "points", buyerId, friendId: f.phone, points, amount, message } });
    const payment = await paymentService.createOrder({ orderCode: code, purpose: "gift_points", userId: buyerId, method: "fonepay", amount });
    return { gift: await this.view(gift, buyerId), payment };
  }

  /** The price of a gifted game: what the friend would pay for that hour (their club or VIP discount counts). */
  async quoteGame(buyerId: string, input: { friendPhone?: unknown; date?: unknown; startTime?: unknown }) {
    const f = await this.friend(buyerId, input.friendPhone);
    const { date, startTime } = this.slot(input);
    const q = await BookingService.quote(date, startTime, 1, undefined, f.phone);
    return { friend: f, date, startTime, basePrice: q.basePrice, discount: q.discount, total: q.total };
  }

  /** Book a game in the friend's name, paid in full online by the buyer. The slot is held while the QR is open. */
  async bookGame(buyerId: string, input: { friendPhone?: unknown; date?: unknown; startTime?: unknown; message?: unknown }) {
    const f = await this.friend(buyerId, input.friendPhone);
    const { date, startTime } = this.slot(input);
    const message = cleanMessage(input.message);
    await this.assertDaily(buyerId);

    const booking = await BookingService.createBooking({ date, startTime, duration: 1, paymentMethod: "full", notes: `${GIFT_TAG}${buyerId}` }, f.phone);
    try {
      if (booking.totalPrice <= 0) throw new AppError(409, "This hour has nothing to pay, so it cannot be a gift. Choose another time.");
      const code = await this.newCode();
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "pending", paymentStatus: "pending", holdExpiresAt: new Date(Date.now() + QR_HOLD_MS), paymentOrderCode: booking.id },
      });
      const gift = await prisma.gift.create({ data: { code, kind: "game", buyerId, friendId: f.phone, bookingId: booking.id, amount: booking.totalPrice, message } });
      const payment = await paymentService.createOrder({ orderCode: booking.id, purpose: "game", userId: buyerId, method: "fonepay", amount: booking.totalPrice });
      return { gift: await this.view(gift, buyerId), payment };
    } catch (e) {
      // roll back: free the slot so nothing stays blocked
      await prisma.gift.deleteMany({ where: { bookingId: booking.id, status: "pending" } });
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled", cancelledAt: new Date(), notes: `${GIFT_TAG}${buyerId} | CHECKOUT_FAILED` } });
      await BookingService.freeSlots(booking.id);
      throw e;
    }
  }

  /** Payment confirmed for a points gift (called once per order by PaymentService.markPaid). */
  async deliverPoints(orderCode: string): Promise<boolean> {
    const g = await prisma.gift.findUnique({ where: { code: orderCode } });
    if (!g || g.kind !== "points" || !g.points) return false;
    await prisma.gift.update({ where: { id: g.id }, data: { status: "paid", paidAt: new Date() } });
    const buyer = await prisma.user.findUnique({ where: { phoneNumber: g.buyerId }, select: { name: true } });
    const from = firstName(buyer?.name);
    await loyaltyService.award({ userId: g.friendId, kind: "gift", points: g.points, sourceType: "gift", sourceId: g.id, detail: `Gift from ${from}` });
    await notificationService.notify({
      userId: g.friendId, type: "points", title: "You got a gift",
      message: `${from} sent you ${g.points} loyalty points.${g.message ? ` "${g.message}"` : ""}`,
      href: await loyaltyService.pointsHref(g.friendId, "gift", g.id), dedupeKey: `gift-in-${g.id}`,
    });
    await notificationService.notify({
      userId: g.buyerId, type: "payment", title: "Gift sent",
      message: `Rs. ${g.amount} received. ${g.points} points were added to your friend's account.`,
      href: "/gift-card", dedupeKey: `gift-out-${g.id}`,
    });
    return true;
  }

  /** The booking of a game gift was paid: mark the gift and tell both. Does nothing for an ordinary booking. */
  async onGamePaid(bookingId: string) {
    const g = await prisma.gift.findUnique({ where: { bookingId } });
    if (!g || g.status === "paid") return;
    await prisma.gift.update({ where: { id: g.id }, data: { status: "paid", paidAt: new Date() } });
    const [buyer, b] = await Promise.all([
      prisma.user.findUnique({ where: { phoneNumber: g.buyerId }, select: { name: true } }),
      prisma.booking.findUnique({ where: { id: bookingId }, select: { date: true, startTime: true, endTime: true } }),
    ]);
    const when = b ? `${b.date} · ${b.startTime} – ${b.endTime}` : "";
    await notificationService.notify({
      userId: g.friendId, type: "booking", title: "You got a game as a gift",
      message: `${firstName(buyer?.name)} booked and paid a game for you: ${when}.${g.message ? ` "${g.message}"` : ""}`,
      href: "/profile", dedupeKey: `gift-in-${g.id}`,
    });
    await notificationService.notify({
      userId: g.buyerId, type: "payment", title: "Gift sent",
      message: `Rs. ${g.amount} received. The game on ${when} is booked for your friend.`,
      href: "/gift-card", dedupeKey: `gift-out-${g.id}`,
    });
  }

  async view(g: Gift, me: string) {
    const other = me === g.buyerId ? g.friendId : g.buyerId;
    const [u, b] = await Promise.all([
      prisma.user.findUnique({ where: { phoneNumber: other }, select: { name: true } }),
      g.bookingId ? prisma.booking.findUnique({ where: { id: g.bookingId }, select: { date: true, startTime: true, endTime: true, code: true } }) : null,
    ]);
    return {
      id: g.id, code: g.code, kind: g.kind, role: me === g.buyerId ? "sent" : "received",
      otherName: firstName(u?.name), points: g.points, amount: g.amount, message: g.message, status: g.status,
      game: b ? { date: b.date, startTime: b.startTime, endTime: b.endTime, code: b.code } : null,
      createdAt: g.createdAt, paidAt: g.paidAt,
    };
  }

  /** Gifts I sent (any status) and gifts I received (paid only). */
  async mine(userId: string) {
    const rows = await prisma.gift.findMany({
      where: { OR: [{ buyerId: userId }, { friendId: userId, status: "paid" }] },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return { rules: this.rules(), gifts: await Promise.all(rows.map((g) => this.view(g, userId))) };
  }
}

export const giftService = new GiftService();
export default giftService;
