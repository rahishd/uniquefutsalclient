import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";

// What anyone who types a verification code on the customer site may see. It is enough to tell a genuine bill or document
// from a fake: what was paid for, how much, when, how, and who it was issued to. The customer's phone number, email and
// account are never shown, and the name is shortened ("Rahish D.").
export const maskName = (name: string | null | undefined) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

const MEDIA = "/api/content/media/";
const money = (n: number) => Math.round(n);
const methodLabel = (m: string | null | undefined) =>
  m === "cash" || m === "venue" || m === "pay_at_venue" ? "Cash at the venue" : m === "online" || m === "fonepay" ? "Online (Fonepay)" : m === "due" ? "On account" : (m ?? "");

type Line = { type: string; label: string; quantity: number; amount: number };
export interface PaymentView {
  genuine: true;
  kind: "payment";
  code: string;
  issuedBy: "Unique Futsal";
  issuedAt: string;
  bill: {
    reference: string;
    type: "bill" | "game" | "gamezone";
    customer: string;
    date: string;
    time: string | null;
    lines: Line[];
    total: number;
    method: string;
    status: string;
    payments: { method: string; amount: number }[];
  };
}
export interface DocumentView {
  genuine: true;
  kind: "document";
  code: string;
  issuedBy: "Unique Futsal";
  issuedAt: string;
  document: { title: string; issuedTo: string | null; orgType: string | null; details: string | null; photos: string[] };
}

async function paymentView(row: { code: string; sourceType: string | null; sourceId: string | null; createdAt: Date }): Promise<PaymentView | null> {
  const base = { genuine: true as const, kind: "payment" as const, code: row.code, issuedBy: "Unique Futsal" as const, issuedAt: row.createdAt.toISOString() };
  const id = row.sourceId ?? "";
  if (row.sourceType === "checkout") {
    const b = await prisma.checkout.findUnique({ where: { id } });
    if (!b) return null;
    const user = await prisma.user.findUnique({ where: { phoneNumber: b.userId }, select: { name: true } });
    const lines = JSON.parse(b.lines) as Line[];
    return {
      ...base,
      bill: { reference: b.code, type: "bill", customer: maskName(user?.name), date: todayKey(b.createdAt), time: null, lines, total: b.total, method: methodLabel(b.paymentMethod), status: "Paid", payments: [{ method: methodLabel(b.paymentMethod), amount: b.total }] },
    };
  }
  if (row.sourceType === "booking") {
    const b = await prisma.booking.findUnique({ where: { id } });
    if (!b || b.paymentStatus !== "completed") return null;
    const user = b.userId ? await prisma.user.findUnique({ where: { phoneNumber: b.userId }, select: { name: true } }) : null;
    const lines: Line[] = [{ type: "game", label: `Futsal court, ${b.startTime} to ${b.endTime}`, quantity: 1, amount: money(b.basePrice) }];
    if (b.addOnsPrice > 0) lines.push({ type: "goods", label: "Add-ons", quantity: 1, amount: money(b.addOnsPrice) });
    if (b.discountAmount > 0) lines.push({ type: "discount", label: b.promoCode ? `Discount (${b.promoCode})` : "Discount", quantity: 1, amount: -money(b.discountAmount) });
    const payments = [{ method: "Cash at the venue", amount: money(b.cashAmount) }, { method: "Online (Fonepay)", amount: money(b.onlineAmount) }].filter((p) => p.amount > 0);
    return {
      ...base,
      bill: {
        reference: b.code ?? `UF-${b.id.slice(-6).toUpperCase()}`, type: "game", customer: maskName(b.customerName ?? user?.name), date: b.date, time: `${b.startTime} - ${b.endTime}`,
        lines, total: money(b.totalPrice), method: methodLabel(b.paymentMethod), status: "Paid", payments: payments.length ? payments : [{ method: methodLabel(b.paymentMethod), amount: money(b.totalPrice) }],
      },
    };
  }
  if (row.sourceType === "gamezone") {
    const g = await prisma.gzBooking.findUnique({ where: { code: id } });
    if (!g || g.paymentStatus !== "paid") return null;
    const user = g.userId ? await prisma.user.findUnique({ where: { phoneNumber: g.userId }, select: { name: true } }) : null;
    const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
    return {
      ...base,
      bill: {
        reference: g.code, type: "gamezone", customer: maskName(g.guestName ?? user?.name), date: g.date, time: `${hh(g.startHour)} - ${hh(g.startHour + g.hours)}`,
        lines: [{ type: "game", label: `Gamezone: ${g.gameTitle}, ${g.hours} ${g.hours === 1 ? "hour" : "hours"}, ${g.players} ${g.players === 1 ? "player" : "players"}`, quantity: 1, amount: g.total }],
        total: g.total, method: methodLabel(g.paymentMethod), status: "Paid", payments: [{ method: methodLabel(g.paymentMethod), amount: g.total }],
      },
    };
  }
  return null;
}

/** The public answer for a code, or null when it is not a genuine, current code. */
export async function lookupCode(code: string): Promise<PaymentView | DocumentView | null> {
  const row = await prisma.docVerification.findUnique({ where: { code } });
  if (!row || row.revokedAt) return null;
  if (row.kind === "document") {
    return {
      genuine: true, kind: "document", code: row.code, issuedBy: "Unique Futsal", issuedAt: row.createdAt.toISOString(),
      document: { title: row.title ?? "Document", issuedTo: row.issuedTo, orgType: row.orgType, details: row.details, photos: row.mediaIds.map((m) => `${MEDIA}${m}`) },
    };
  }
  return paymentView(row);
}

// Wrong codes are counted per connection: a few honest mistakes are fine, but a program trying every 4-digit code is stopped
// after a handful of guesses for an hour. Correct codes never use up the allowance.
export const MAX_WRONG = 8;
export const WINDOW_MS = 60 * 60 * 1000;
const wrong = new Map<string, { count: number; resetAt: number }>();

export function attemptsLeft(who: string, now = Date.now()): number {
  const w = wrong.get(who);
  if (!w || w.resetAt <= now) return MAX_WRONG;
  return Math.max(0, MAX_WRONG - w.count);
}
export function recordWrong(who: string, now = Date.now()) {
  const w = wrong.get(who);
  if (!w || w.resetAt <= now) wrong.set(who, { count: 1, resetAt: now + WINDOW_MS });
  else w.count++;
}
export function resetAttempts() {
  wrong.clear();
}
