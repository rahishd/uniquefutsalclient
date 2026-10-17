import { prisma } from "../../config/db";
import logger from "../../config/logger";
import { AppError } from "../../middlewares/error.middleware";
import SettingsService from "../settings/settings.service";
import BookingService from "../booking/booking.service";
import paymentService, { QR_HOLD_MS } from "../payment/payment.service";
import notificationService from "../notification/notification.service";
import pushService from "../push/push.service";
import { addDaysKey, startsAtMs, todayKey } from "../../utils/dates";
import { AgeGroup, dobFilterAny, groupsLabel, inAnyGroup, isAgeGroup, normaliseGroups, parseGroups } from "../../utils/age";

// Find Player: "I need N more players" for a friendly game. Everything is decided here: the number, the window (from tomorrow, 6 days),
// who may join (a request is open to anyone or to one age group), that the spots never go below zero (inside a transaction), the equal split of the court price (win
// or lose), and the advance the host pays once everyone has joined (it books the court).
//
// Status: open -> awaiting_advance (everyone joined; the host has ADVANCE_HOLD_MS to pay) -> confirmed (court booked)
//         or cancelled (the host cancelled, or the advance was not paid in time).
export const MAX_PLAYERS = 11; // players that can be invited (the host is extra)
export const WINDOW_DAYS = 6; // from tomorrow, for 6 days (never today)
export const PER_DAY = 3;
export const NOTE_MAX = 140;
export const ADVANCE_FEE = 300; // rupees, paid online by the host
export const ADVANCE_HOLD_MS = 2 * 60 * 60 * 1000;

// "open" = anyone can join; otherwise only players in that age group are told about it and may join (age comes from the date of birth)
export const ageLabel = (g: string) => (g === "open" ? "Open" : g === "40+" ? "40+ years" : `${g} years`);
const viewerDobOf = async (userId: string) => (await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { dateOfBirth: true } }))?.dateOfBirth ?? null;

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const startsAt = (r: { date: string; startHour: number }) => startsAtMs(r.date, r.startHour);
const plural = (n: number) => `${n} Player${n === 1 ? "" : "s"}`;

type Row = {
  id: string;
  userId: string;
  date: string;
  startHour: number;
  playersNeeded: number;
  ageGroup: string;
  note: string | null;
  status: string;
  courtPrice: number;
  bookingId: string | null;
  advanceDueAt: Date | null;
  createdAt: Date;
  joins: { userId: string; createdAt: Date }[];
};

async function namesOf(phones: string[]) {
  const users = phones.length ? await prisma.user.findMany({ where: { phoneNumber: { in: phones } }, select: { phoneNumber: true, name: true } }) : [];
  return new Map(users.map((u) => [u.phoneNumber, u.name?.trim() || `Player ${u.phoneNumber.slice(-4)}`]));
}

/** Equal split of the court price among everyone playing (host included). The host's share absorbs the rounding. */
export function splitOf(courtPrice: number, playersNeeded: number) {
  const everyone = playersNeeded + 1;
  const each = Math.round(courtPrice / everyone);
  const hostShare = courtPrice - each * (everyone - 1);
  return { everyone, each, hostShare, hostPaysAtVenue: Math.max(hostShare - ADVANCE_FEE, 0) };
}

export class PlayerRequestService {
  private view(r: Row, viewer: string, names: Map<string, string>, viewerDob: string | null) {
    const joined = r.joins.length;
    const started = startsAt(r) <= Date.now();
    const live = r.status === "open" || r.status === "awaiting_advance";
    const status = live && started ? "expired" : r.status;
    const split = splitOf(r.courtPrice, r.playersNeeded);
    return {
      id: r.id,
      posterName: names.get(r.userId) ?? "Player",
      mine: r.userId === viewer,
      date: r.date,
      hour: r.startHour,
      playersNeeded: r.playersNeeded,
      ageGroup: r.ageGroup,
      // false when the game is for another age group (or the viewer has not given a date of birth yet)
      ageGroups: parseGroups(r.ageGroup),
      eligible: inAnyGroup(viewerDob, parseGroups(r.ageGroup), todayKey()),
      needsDob: !parseGroups(r.ageGroup).includes("open") && !viewerDob,
      joined,
      spotsLeft: Math.max(r.playersNeeded - joined, 0),
      note: r.note,
      status,
      joinedByMe: r.joins.some((j) => j.userId === viewer),
      // only the poster sees who joined
      joiners: r.userId === viewer ? r.joins.map((j) => ({ phone: j.userId, name: names.get(j.userId) ?? "Player" })) : undefined,
      // friendly game: the court price is shared equally, whoever wins or loses
      courtPrice: r.courtPrice,
      everyone: split.everyone,
      sharePerPlayer: split.each,
      hostShare: split.hostShare,
      advanceFee: ADVANCE_FEE,
      hostPaysAtVenue: split.hostPaysAtVenue,
      advanceDueAt: r.status === "awaiting_advance" ? r.advanceDueAt : null,
      confirmed: r.status === "confirmed",
      createdAt: r.createdAt,
    };
  }

  private async load(id: string): Promise<Row> {
    const r = await prisma.playerRequest.findUnique({ where: { id }, include: { joins: { select: { userId: true, createdAt: true }, orderBy: { createdAt: "asc" } } } });
    if (!r) throw new AppError(404, "This request is not available any more.");
    return this.reconcile(r);
  }

  /**
   * Moves a request along when something happened outside it: the advance was paid (the booking became confirmed), or
   * the host ran out of time to pay it. Safe to run any number of times.
   */
  private async reconcile(r: Row): Promise<Row> {
    if (r.status === "awaiting_advance" && r.bookingId) {
      const b = await prisma.booking.findUnique({ where: { id: r.bookingId }, select: { status: true, paymentStatus: true } });
      if (b && b.status === "confirmed" && (b.paymentStatus === "partially_paid" || b.paymentStatus === "completed")) {
        const upd = await prisma.playerRequest.updateMany({ where: { id: r.id, status: "awaiting_advance" }, data: { status: "confirmed", advanceDueAt: null } });
        if (upd.count > 0) {
          const names = await namesOf([r.userId]);
          const who = names.get(r.userId) ?? "The host";
          for (const j of r.joins) {
            await notificationService.notify({
              userId: j.userId,
              type: "players",
              title: "Game confirmed",
              message: `${who}'s game on ${r.date} at ${hh(r.startHour)} is confirmed. The court is booked.`,
              href: `/find-player/${r.id}`,
              dedupeKey: `players-confirmed-${r.id}-${j.userId}`,
            });
          }
          await notificationService.notify({
            userId: r.userId,
            type: "players",
            title: "Court booked",
            message: `Advance received. Your game on ${r.date} at ${hh(r.startHour)} is confirmed.`,
            href: `/find-player/${r.id}`,
            dedupeKey: `players-booked-${r.id}`,
          });
        }
        return { ...r, status: "confirmed", advanceDueAt: null };
      }
    }
    if (r.status === "awaiting_advance" && r.advanceDueAt && r.advanceDueAt.getTime() < Date.now()) {
      await this.cancelRow(r, "The host did not pay the advance in time.");
      return { ...r, status: "cancelled" };
    }
    return r;
  }

  /** Closes a request, lets go of a court booking that was held for it, and tells the people who had joined. */
  private async cancelRow(r: Row, reason: string, hostCancelled = false) {
    const upd = await prisma.playerRequest.updateMany({ where: { id: r.id, status: { in: ["open", "awaiting_advance", "confirmed"] } }, data: { status: "cancelled", advanceDueAt: null } });
    if (upd.count === 0) return;
    if (r.bookingId) {
      try {
        // frees the court; an advance already paid is marked for refund (like any cancelled online booking)
        await BookingService.cancelBooking(r.bookingId, r.userId);
      } catch (e) {
        logger.warn(`Find Player ${r.id}: the court booking could not be cancelled (${e instanceof Error ? e.message : "error"})`);
      }
    }
    const names = await namesOf([r.userId]);
    const who = names.get(r.userId) ?? "The host";
    for (const j of r.joins) {
      await notificationService.notify({
        userId: j.userId,
        type: "players",
        title: "Game cancelled",
        message: hostCancelled ? `${who} cancelled the game on ${r.date} at ${hh(r.startHour)}.` : `The game on ${r.date} at ${hh(r.startHour)} was cancelled. ${reason}`,
        href: `/find-player/${r.id}`,
        dedupeKey: `players-cancelled-${r.id}-${j.userId}`,
      });
    }
    if (!hostCancelled) {
      await notificationService.notify({ userId: r.userId, type: "players", title: "Request cancelled", message: reason, href: `/find-player/${r.id}`, dedupeKey: `players-cancelled-${r.id}-host` });
    }
  }

  async create(userId: string, input: { date?: unknown; hour?: unknown; players?: unknown; note?: unknown; ageGroup?: unknown; ageGroups?: unknown }) {
    // several groups: a list (ageGroups), or the older single value (ageGroup); Open means anyone
    const picked = Array.isArray(input.ageGroups) ? input.ageGroups : [input.ageGroup].filter((v) => v !== undefined && v !== null && v !== "");
    if (picked.some((v) => !isAgeGroup(v))) throw new AppError(400, "Choose Open or one or more of the age groups.");
    const ageGroups: AgeGroup[] = normaliseGroups(picked);
    const date = typeof input.date === "string" ? input.date : "";
    const hour = Number(input.hour);
    const players = Number(input.players);
    if (!Number.isInteger(players) || players < 1 || players > MAX_PLAYERS) throw new AppError(400, `Choose how many players you need (1 to ${MAX_PLAYERS}).`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "Pick a date.");
    const today = todayKey();
    // from tomorrow: a game cannot be asked for on the same day
    if (date < addDaysKey(today, 1) || date > addDaysKey(today, WINDOW_DAYS)) throw new AppError(400, `Pick a day from tomorrow, within the next ${WINDOW_DAYS} days.`);
    const slots = await SettingsService.getTimeSlots();
    if (!Number.isInteger(hour) || !slots.includes(hh(hour))) throw new AppError(400, "That time is not open for games.");
    if (startsAtMs(date, hour) <= Date.now()) throw new AppError(400, "That time has already started. Pick a later time.");
    const note = typeof input.note === "string" ? input.note.trim().slice(0, NOTE_MAX) : "";

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.playerRequest.count({ where: { userId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can post up to ${PER_DAY} requests a day. Please try again tomorrow.`);
    }
    const dup = await prisma.playerRequest.findFirst({ where: { userId, date, startHour: hour, status: { in: ["open", "awaiting_advance", "confirmed"] } }, select: { id: true } });
    if (dup) throw new AppError(409, "You already have a request for that time.");

    const courtPrice = (await BookingService.quote(date, hh(hour), 1)).basePrice;
    const row = await prisma.playerRequest.create({ data: { userId, date, startHour: hour, playersNeeded: players, ageGroup: ageGroups.join(","), note: note || null, courtPrice } });
    void this.broadcast(row.id, userId, players, ageGroups);
    return { id: row.id };
  }

  /** One in-app notice (and a push to devices) to every other registered customer. Runs after the answer is sent. */
  private async broadcast(requestId: string, posterId: string, players: number, groups: AgeGroup[]) {
    try {
      const names = await namesOf([posterId]);
      const title = "Players needed";
      const message = `${names.get(posterId) ?? "A player"} needs ${plural(players)}${groups.includes("open") ? "" : ` aged ${groupsLabel(groups)}`} for Upcoming Game. View the deal`;
      const ageWhere = dobFilterAny(groups, todayKey()); // Open: everyone; a group: only people whose date of birth puts them in it
      const href = `/find-player/${requestId}`;
      const CHUNK = 500;
      let cursor: string | undefined;
      for (;;) {
        const users = await prisma.user.findMany({
          where: { role: "user", isActive: true, NOT: { phoneNumber: posterId }, ...ageWhere },
          select: { phoneNumber: true },
          orderBy: { phoneNumber: "asc" },
          take: CHUNK,
          ...(cursor ? { skip: 1, cursor: { phoneNumber: cursor } } : {}),
        });
        if (!users.length) break;
        await prisma.notification.createMany({
          data: users.map((u) => ({ userId: u.phoneNumber, type: "players", title, message, href, dedupeKey: `players-${requestId}-${u.phoneNumber}` })),
          skipDuplicates: true,
        });
        // devices with the app closed (a push is skipped for people who switched promotional notifications off)
        for (let i = 0; i < users.length; i += 25) {
          await Promise.all(users.slice(i, i + 25).map((u) => pushService.sendToUser(u.phoneNumber, "players", { title, body: message, href, tag: `players-${requestId}` })));
        }
        cursor = users[users.length - 1].phoneNumber;
        if (users.length < CHUNK) break;
      }
    } catch (e) {
      logger.error("Player request broadcast failed", e);
    }
  }

  /** Requests that have not started: the open ones, plus the viewer's own and the ones they joined. */
  async list(userId: string) {
    const today = todayKey();
    const rows = await prisma.playerRequest.findMany({
      where: { status: { in: ["open", "awaiting_advance", "confirmed"] }, date: { gte: today } },
      include: { joins: { select: { userId: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ date: "asc" }, { startHour: "asc" }],
      take: 100,
    });
    const settled: Row[] = [];
    for (const r of rows) settled.push(await this.reconcile(r));
    const dob = await viewerDobOf(userId);
    const involved = (r: Row) => r.userId === userId || r.joins.some((j) => j.userId === userId);
    const live = settled.filter((r) => startsAt(r) > Date.now() && r.status !== "cancelled" && (involved(r) || (r.status === "open" && inAnyGroup(dob, parseGroups(r.ageGroup), todayKey()))));
    const names = await namesOf([...new Set(live.flatMap((r) => [r.userId, ...r.joins.map((j) => j.userId)]))]);
    return live.map((r) => this.view(r, userId, names, dob));
  }

  async detail(userId: string, id: string) {
    const r = await this.load(id);
    const names = await namesOf([r.userId, ...r.joins.map((j) => j.userId)]);
    return this.view(r, userId, names, await viewerDobOf(userId));
  }

  async join(userId: string, id: string) {
    const r = await this.load(id);
    if (r.userId === userId) throw new AppError(400, "This is your own request.");
    if (r.status === "cancelled") throw new AppError(400, "The host cancelled this request.");
    if (startsAt(r) <= Date.now()) throw new AppError(400, "This game has already started.");
    if (r.joins.some((j) => j.userId === userId)) throw new AppError(409, "You have already joined.");
    const dob = await viewerDobOf(userId);
    if (!inAnyGroup(dob, parseGroups(r.ageGroup), todayKey())) {
      throw new AppError(403, dob ? `This game is for players aged ${groupsLabel(parseGroups(r.ageGroup))}.` : "Add your date of birth in your Profile to join age-group games.");
    }

    // the spots can never go below zero, even when two people tap at once
    const left = await prisma.$transaction(async (tx) => {
      const fresh = await tx.playerRequest.findUnique({ where: { id }, select: { playersNeeded: true, status: true } });
      if (!fresh || fresh.status !== "open") throw new AppError(400, "This request is full or closed.");
      const count = await tx.playerRequestJoin.count({ where: { requestId: id } });
      if (count >= fresh.playersNeeded) throw new AppError(400, "All spots are taken.");
      await tx.playerRequestJoin.create({ data: { requestId: id, userId } });
      const remaining = fresh.playersNeeded - count - 1;
      if (remaining === 0) await tx.playerRequest.update({ where: { id }, data: { status: "awaiting_advance", advanceDueAt: new Date(Date.now() + ADVANCE_HOLD_MS) } });
      return remaining;
    });

    const names = await namesOf([userId]);
    const who = names.get(userId) ?? "A player";
    if (left === 0) {
      await notificationService.notify({
        userId: r.userId,
        type: "players",
        title: "Everyone has joined",
        message: `${who} joined. All ${plural(r.playersNeeded)} are in. Pay Rs. ${ADVANCE_FEE} to book the court within 2 hours.`,
        href: `/find-player/${id}`,
      });
    } else {
      await notificationService.notify({
        userId: r.userId,
        type: "players",
        title: "A player joined",
        message: `${who} joined your game. ${plural(left)} still needed.`,
        href: `/find-player/${id}`,
      });
    }
    return this.detail(userId, id);
  }

  async leave(userId: string, id: string) {
    const r = await this.load(id);
    const mine = r.joins.find((j) => j.userId === userId);
    if (!mine) throw new AppError(400, "You have not joined this request.");
    if (r.status === "confirmed") throw new AppError(400, "The court is already booked. Please contact the host if you cannot make it.");
    if (r.status === "cancelled") throw new AppError(400, "This request is closed.");
    await prisma.$transaction(async (tx) => {
      await tx.playerRequestJoin.delete({ where: { requestId_userId: { requestId: id, userId } } });
      if (r.status === "awaiting_advance") await tx.playerRequest.update({ where: { id }, data: { status: "open", advanceDueAt: null } });
    });
    // a QR that was made for the full group is no longer right: let go of the held court time
    if (r.status === "awaiting_advance" && r.bookingId) {
      try {
        await BookingService.cancelBooking(r.bookingId, r.userId);
      } catch (e) {
        logger.warn(`Find Player ${id}: could not release the held court (${e instanceof Error ? e.message : "error"})`);
      }
      await prisma.playerRequest.update({ where: { id }, data: { bookingId: null } });
    }
    return this.detail(userId, id);
  }

  async cancel(userId: string, id: string) {
    const r = await this.load(id);
    if (r.userId !== userId) throw new AppError(403, "Only the person who posted can cancel this.");
    if (r.status !== "cancelled") await this.cancelRow(r, "", true);
    return this.detail(userId, id);
  }

  /**
   * The host pays the advance (online, Fonepay QR) once everyone has joined. This books the court for that hour; the
   * rest of the court price is paid at the venue, shared equally. Returns the QR order to show.
   */
  async advance(userId: string, id: string) {
    const r = await this.load(id);
    if (r.userId !== userId) throw new AppError(403, "Only the person who posted can pay the advance.");
    if (r.status === "confirmed") throw new AppError(400, "The advance is already paid and the court is booked.");
    if (r.status !== "awaiting_advance") throw new AppError(400, r.status === "open" ? "Wait until everyone has joined." : "This request is closed.");
    if (startsAt(r) <= Date.now()) throw new AppError(400, "This game has already started.");

    // a QR made a moment ago is still valid: show it again instead of making a second booking
    if (r.bookingId) {
      const order = await prisma.paymentOrder.findUnique({ where: { orderCode: r.bookingId } });
      if (order && order.status === "pending" && order.expiresAt.getTime() > Date.now()) return paymentService.publicView(order);
      const b = await prisma.booking.findUnique({ where: { id: r.bookingId }, select: { status: true } });
      if (b && b.status !== "cancelled") throw new AppError(409, "A payment is already in progress. Please check again in a moment.");
    }

    const booking = await BookingService.createBooking({ date: r.date, startTime: hh(r.startHour), duration: 1, paymentMethod: "venue" }, userId).catch((e) => {
      if (e instanceof AppError) throw new AppError(409, "That court time was taken meanwhile, so it cannot be booked. You can cancel this request and post a new one.");
      throw e;
    });

    const advance = Math.min(ADVANCE_FEE, booking.totalPrice);
    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "pending", paymentStatus: "pending", holdExpiresAt: new Date(Date.now() + QR_HOLD_MS), paymentOrderCode: booking.id, notes: `FIND_PLAYER:${r.id}` },
      });
      const order = await paymentService.createOrder({ orderCode: booking.id, purpose: "game", userId, method: "fonepay", amount: advance });
      await prisma.playerRequest.update({ where: { id: r.id }, data: { bookingId: booking.id } });
      return order;
    } catch (e) {
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled", cancelledAt: new Date(), notes: "CHECKOUT_FAILED" } });
      await BookingService.freeSlots(booking.id);
      throw e;
    }
  }

  /** Job: closes requests whose advance was not paid in time, and settles ones whose advance has been paid. */
  async sweep(): Promise<number> {
    const rows = await prisma.playerRequest.findMany({
      where: { status: "awaiting_advance" },
      include: { joins: { select: { userId: true, createdAt: true } } },
      take: 200,
    });
    let n = 0;
    for (const r of rows) {
      const after = await this.reconcile(r);
      if (after.status !== r.status) n++;
    }
    return n;
  }
}

export default new PlayerRequestService();
