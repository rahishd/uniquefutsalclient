import { randomInt } from "crypto";
import { WheelchairRequest } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { todayKey } from "../../utils/dates";

export const WC_STATUSES = ["pending", "confirmed", "completed", "declined", "cancelled"] as const;
export const NOTE_MAX = 500;
export const MAX_PEOPLE = 10;
export const PER_DAY = 3; // anti-spam: requests one customer can send in 24 hours
export const DAYS_AHEAD = 60;

// Short code the customer quotes ("WC-7K3QX9"); no 0/O/1/I so it is easy to read out.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "WC-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function view(r: WheelchairRequest) {
  return {
    id: r.id, code: r.code, date: r.date, time: r.time, people: r.people, note: r.note, bookingCode: r.bookingCode,
    status: r.status, staffReply: r.staffReply, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export class WheelchairService {
  async create(userId: string, input: { date?: unknown; time?: unknown; people?: unknown; note?: unknown; bookingCode?: unknown }) {
    const today = todayKey();
    const date = typeof input.date === "string" ? input.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "Choose the day you are coming.");
    if (date < today) throw new AppError(400, "Choose today or a later day.");
    if (date > addDays(today, DAYS_AHEAD)) throw new AppError(400, `Requests can be made up to ${DAYS_AHEAD} days ahead.`);
    const time = typeof input.time === "string" ? input.time : "";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new AppError(400, "Choose about what time you are coming.");
    const people = Number(input.people ?? 1);
    if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) throw new AppError(400, `Tell us how many wheelchair users (1 to ${MAX_PEOPLE}).`);
    const note = typeof input.note === "string" ? input.note.trim() : "";
    if (note.length > NOTE_MAX) throw new AppError(400, `Please keep the note under ${NOTE_MAX} characters.`);

    let bookingCode: string | null = null;
    if (typeof input.bookingCode === "string" && input.bookingCode.trim()) {
      const code = input.bookingCode.trim().toUpperCase().slice(0, 20);
      // only a booking on this customer's own account can be referenced
      const own = await prisma.booking.findFirst({ where: { code, OR: [{ userId }, { customerPhone: userId }] }, select: { id: true } });
      const ownGz = own ? null : await prisma.gzBooking.findFirst({ where: { code, userId }, select: { id: true } });
      if (!own && !ownGz) throw new AppError(400, "That booking code is not on your account. Check it, or leave it empty.");
      bookingCode = code;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.wheelchairRequest.count({ where: { userId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can send up to ${PER_DAY} requests a day. Please try again tomorrow, or call the venue.`);
    }

    let code = makeCode();
    for (let i = 0; i < 5 && (await prisma.wheelchairRequest.findUnique({ where: { code }, select: { id: true } })); i++) code = makeCode();
    return view(await prisma.wheelchairRequest.create({ data: { code, userId, date, time, people, note: note || null, bookingCode } }));
  }

  async mine(userId: string) {
    const rows = await prisma.wheelchairRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map(view);
  }

  // The customer withdraws a request that is still waiting or confirmed (not one that is already done).
  async cancel(userId: string, id: string) {
    const r = await prisma.wheelchairRequest.findFirst({ where: { id, userId } });
    if (!r) throw new AppError(404, "Request not found");
    if (r.status !== "pending" && r.status !== "confirmed") throw new AppError(409, "This request can no longer be cancelled.");
    return view(await prisma.wheelchairRequest.update({ where: { id }, data: { status: "cancelled" } }));
  }
}

export default new WheelchairService();
