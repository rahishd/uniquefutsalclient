import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { addDaysKey, todayKey } from "../../utils/dates";

// Health tracker: the customer's own daily check-in (sleep, water, energy, mood, soreness, how the game went, weight)
// and a play plan (days of the week and the hour for the "book your game" reminder). Private to the customer.
export const MAX_DAYS = 90;
export const DEFAULT_DAYS = 30;

const KEY = /^\d{4}-\d{2}-\d{2}$/;

function whole(v: unknown, min: number, max: number, label: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, `${label} must be a whole number from ${min} to ${max}`);
  return n;
}
function decimal(v: unknown, min: number, max: number, label: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new AppError(400, `${label} must be from ${min} to ${max}`);
  return Math.round(n * 10) / 10;
}

export const healthService = {
  // The last N days of check-ins, the plan, and the games the customer played in that time (from their bookings).
  async me(userId: string, days = DEFAULT_DAYS) {
    const span = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), MAX_DAYS) : DEFAULT_DAYS;
    const today = todayKey();
    const from = addDaysKey(today, -(span - 1));
    const [plan, logs, games] = await Promise.all([
      prisma.healthPlan.findUnique({ where: { userId } }),
      prisma.healthLog.findMany({ where: { userId, day: { gte: from, lte: today } }, orderBy: { day: "asc" } }),
      prisma.booking.findMany({
        where: { userId, date: { gte: from, lte: today }, status: { in: ["confirmed", "completed"] } },
        select: { date: true, startTime: true, duration: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
    ]);
    return {
      today,
      plan: plan ?? { userId, playDays: [], remindHour: 8, remind: true, sleepGoal: 8, waterGoal: 8 },
      logs,
      games,
    };
  },

  // One check-in per day; saving again for the same day replaces it. Days from the last 90 days up to today.
  async saveLog(userId: string, b: Record<string, unknown>) {
    const today = todayKey();
    const day = String(b.day ?? today);
    if (!KEY.test(day) || day > today || day < addDaysKey(today, -MAX_DAYS)) throw new AppError(400, "Pick a day from the last 90 days");
    const data = {
      sleepHours: decimal(b.sleepHours, 0, 24, "Sleep"),
      water: whole(b.water, 0, 30, "Water"),
      energy: whole(b.energy, 1, 5, "Energy"),
      mood: whole(b.mood, 1, 5, "Mood"),
      soreness: whole(b.soreness, 1, 5, "Soreness"),
      performance: whole(b.performance, 1, 5, "Game rating"),
      weightKg: decimal(b.weightKg, 20, 250, "Weight"),
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 300) : null,
    };
    if (Object.values(data).every((v) => v === null)) throw new AppError(400, "Add at least one detail to save");
    return prisma.healthLog.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, ...data }, update: data });
  },

  async savePlan(userId: string, b: Record<string, unknown>) {
    const raw = Array.isArray(b.playDays) ? b.playDays : [];
    const playDays = [...new Set(raw.map((d) => Number(d)))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    const data = {
      playDays,
      remindHour: whole(b.remindHour ?? 8, 0, 23, "Reminder hour") ?? 8,
      remind: b.remind !== false,
      sleepGoal: decimal(b.sleepGoal ?? 8, 4, 12, "Sleep goal") ?? 8,
      waterGoal: whole(b.waterGoal ?? 8, 1, 30, "Water goal") ?? 8,
    };
    return prisma.healthPlan.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  },
};

export default healthService;
