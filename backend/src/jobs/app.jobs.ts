import { prisma } from "../config/db";
import { fallbackBookingCode } from "../utils/bookingCode";
import logger from "../config/logger";
import notificationService from "../modules/notification/notification.service";
import paymentService from "../modules/payment/payment.service";
import loyaltyService from "../modules/loyalty/loyalty.service";
import playerRequestService from "../modules/playerrequest/playerrequest.service";
import clubService from "../modules/club/club.service";
import goalRushService from "../modules/goalrush/goalrush.service";
import watchEarnService from "../modules/watchearn/watchearn.service";
import { addDaysKey, startsAtMs, todayKey } from "../utils/dates";
import { perMinute, runningClocks } from "../modules/gamezone/gamezone.clock";

// Jobs for the customer app. Each one is safe to run twice: notices carry a dedupe key and every state change is guarded.

const HOUR = 3600000;

// 1-hour reminder in the customer's bell for confirmed court bookings and Gamezone sessions.
export async function sendAppReminders(now = Date.now()): Promise<number> {
  const today = todayKey(new Date(now));
  const tomorrow = addDaysKey(today, 1);
  let sent = 0;

  const bookings = await prisma.booking.findMany({ where: { date: { in: [today, tomorrow] }, status: "confirmed", userId: { not: null }, AND: [{ OR: [{ notes: null }, { NOT: { notes: { contains: "MEMBERSHIP_" } } }] }] } });
  for (const b of bookings) {
    const start = startsAtMs(b.date, parseInt(b.startTime.split(":")[0], 10));
    if (start - now > HOUR + 10 * 60000 || start <= now) continue;
    await notificationService.notify({
      userId: b.userId!, type: "reminder", title: "Your game starts in about an hour",
      message: `${b.date} · ${b.startTime} – ${b.endTime}. Booking ${b.code || fallbackBookingCode(b.id)}.`, href: `/booking/${b.code || fallbackBookingCode(b.id)}`, dedupeKey: `remind-${b.id}`,
    });
    sent++;
  }

  const sessions = await prisma.gzBooking.findMany({ where: { date: { in: [today, tomorrow] }, status: "confirmed", userId: { not: null } } });
  for (const g of sessions) {
    const start = startsAtMs(g.date, g.startHour);
    if (start - now > HOUR + 10 * 60000 || start <= now) continue;
    await notificationService.notify({
      userId: g.userId!, type: "reminder", title: "Your PS5 session starts in about an hour",
      message: `${g.date} · ${String(g.startHour).padStart(2, "0")}:00 for ${g.hours} hr. ${g.code}.`, href: `/booking/${g.code}`, dedupeKey: `remind-${g.code}`,
    });
    sent++;
  }
  return sent;
}

// After the game: a thank-you in the customer's bell (court bookings and Gamezone sessions), with an invitation to book again. Sent once per
// game (dedupe key) within 3 hours after it ended, so old games never get one. The app also shows it as a pop-up (components/ThankYouPrompt.tsx).
// The message carries no booking code on purpose, so the notice opens the booking page instead of the old booking.
export const THANKS_WINDOW_MS = 3 * HOUR;
export async function sendThankYouNotices(now = Date.now()): Promise<number> {
  const today = todayKey(new Date(now));
  const yesterday = addDaysKey(today, -1);
  let sent = 0;
  const message = "Thank you for choosing us. Have a great day ahead! Will you book again for the coming days?";

  const bookings = await prisma.booking.findMany({ where: { date: { in: [yesterday, today] }, status: { in: ["confirmed", "completed"] }, userId: { not: null }, AND: [{ OR: [{ notes: null }, { NOT: { notes: { contains: "MEMBERSHIP_" } } }] }] } });
  for (const b of bookings) {
    const startHour = parseInt(b.startTime.split(":")[0], 10);
    let endHour = parseInt(b.endTime.split(":")[0], 10);
    if (endHour <= startHour) endHour += 24; // a game ending at midnight
    const end = startsAtMs(b.date, endHour);
    if (end > now || now - end > THANKS_WINDOW_MS) continue;
    await notificationService.notify({ userId: b.userId!, type: "booking", title: "Thank you for choosing us", message, href: "/book", dedupeKey: `thanks-${b.id}` });
    sent++;
  }

  const sessions = await prisma.gzBooking.findMany({ where: { date: { in: [yesterday, today] }, status: { in: ["confirmed", "completed"] }, userId: { not: null } } });
  for (const g of sessions) {
    const end = startsAtMs(g.date, g.startHour + g.hours);
    if (end > now || now - end > THANKS_WINDOW_MS) continue;
    await notificationService.notify({ userId: g.userId!, type: "gamezone", title: "Thank you for choosing us", message, href: "/gamezone", dedupeKey: `thanks-${g.code}` });
    sent++;
  }
  return sent;
}

// A started Gamezone session: about 5 minutes before the booked time ends the customer is warned that extra time will be charged per
// minute, and once it has ended they are told the per-minute charge has started. Each notice is sent once (dedupe key), so running this
// every minute is safe. Needs the minute job: the warning window is only 5 minutes wide.
export const GZ_WARN_MS = 5 * 60000;
export async function sendGamezoneClockNotices(now = Date.now()): Promise<number> {
  let sent = 0;
  for (const c of await runningClocks()) {
    const g = await prisma.gzBooking.findUnique({ where: { code: c.bookingCode } });
    if (!g?.userId || g.status !== "confirmed") continue; // guests have no inbox
    const remaining = c.startedAt.getTime() + c.bookedMinutes * 60000 - now;
    const rate = perMinute(c.hourlyRate);
    if (remaining <= 0) {
      await notificationService.notify({
        userId: g.userId, type: "gamezone", title: "Your PS5 time is up",
        message: `Extra time is now charged at Rs. ${rate} per minute until the session is stopped. Session ${g.code}.`, href: `/booking/${g.code}`, dedupeKey: `gz-over-${g.code}`,
      });
      sent++;
    } else if (remaining <= GZ_WARN_MS) {
      const mins = Math.max(1, Math.ceil(remaining / 60000));
      await notificationService.notify({
        userId: g.userId, type: "gamezone", title: `Your PS5 session ends in ${mins} ${mins === 1 ? "minute" : "minutes"}`,
        message: `Please wrap up. After that, extra time is charged at Rs. ${rate} per minute until the session is stopped. Session ${g.code}.`, href: `/booking/${g.code}`, dedupeKey: `gz-warn-${g.code}`,
      });
      sent++;
    }
  }
  return sent;
}

// Challenges nobody answered before the game time are closed.
export async function expireChallenges(now = Date.now()): Promise<number> {
  const open = await prisma.challenge.findMany({ where: { status: "pending", date: { lte: todayKey(new Date(now)) } } });
  let n = 0;
  for (const c of open) {
    if (startsAtMs(c.date, c.startHour) <= now) {
      await prisma.challenge.update({ where: { id: c.id }, data: { status: "expired" } });
      n++;
    }
  }
  return n;
}

export async function runAppJobs(which: "minute" | "tenMinutes" | "daily") {
  try {
    if (which === "minute") {
      const n = await paymentService.expireDue();
      if (n) logger.info(`Expired ${n} unpaid payment holds`);
      await sendGamezoneClockNotices();
      const pr = await playerRequestService.sweep();
      if (pr) logger.info(`Settled ${pr} Find Player requests`);
    } else if (which === "tenMinutes") {
      await sendAppReminders();
      await sendThankYouNotices();
      await expireChallenges();
      await clubService.remindExpiring();
      await goalRushService.abandonStale();
      await watchEarnService.abandonStale();
    } else {
      await loyaltyService.warnExpiringPoints();
    }
  } catch (err) {
    logger.error(`App job "${which}" failed`, err);
  }
}
