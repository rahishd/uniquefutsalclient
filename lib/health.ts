// Health tracker (Home > Health icon, page /health). The customer's own daily check-in (sleep, water, energy, mood, soreness,
// how the game went, weight) and a play plan: the days they want to play and the hour of the "book your game" reminder.
// The server keeps it private to the customer (/wellness); the readiness score and charts are worked out here from those rows.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface HealthLog {
  day: string; // YYYY-MM-DD
  sleepHours: number | null;
  water: number | null; // glasses
  energy: number | null; // 1 to 5
  mood: number | null; // 1 to 5
  soreness: number | null; // 1 (none) to 5 (very sore)
  performance: number | null; // 1 (played low) to 5 (played great)
  weightKg: number | null;
  note: string | null;
}

export interface HealthPlan {
  playDays: number[]; // 0 (Sunday) to 6 (Saturday)
  remindHour: number;
  remind: boolean;
  sleepGoal: number;
  waterGoal: number;
}

export interface PlayedGame { date: string; startTime: string; duration: number }

export interface HealthData { today: string; plan: HealthPlan; logs: HealthLog[]; games: PlayedGame[] }

export const healthStore = createRemoteStore<HealthData | null>(() => api<HealthData>("/wellness/me", { query: { days: 90 } }), { signedOut: null });

export type CheckIn = Partial<Omit<HealthLog, "day">> & { day?: string };

export async function saveCheckIn(body: CheckIn) {
  await api("/wellness/log", { method: "PUT", body });
  await healthStore.refresh();
}

export async function savePlan(body: HealthPlan) {
  await api("/wellness/plan", { method: "PUT", body });
  await healthStore.refresh();
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The words for the 1 to 5 scales. */
export const ENERGY_WORDS = ["Drained", "Low", "Okay", "Good", "Full of energy"];
export const MOOD_WORDS = ["Very low", "Low", "Okay", "Good", "Great"];
export const SORE_WORDS = ["No soreness", "A little", "Some", "Quite sore", "Very sore"];
export const GAME_WORDS = ["Played low", "Below par", "Average", "Played well", "Played great"];

export const dayOfWeek = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};
export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
export const shortDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

/** The last `n` days ending today, oldest first, each with that day's check-in (if any) and the games played that day. */
export function lastDays(data: HealthData, n: number) {
  const byDay = new Map(data.logs.map((l) => [l.day, l]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(data.today, i - (n - 1));
    return { day, log: byDay.get(day) ?? null, games: data.games.filter((g) => g.date === day).length };
  });
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type Readiness = { score: number; label: string; tone: "good" | "ok" | "rest"; tip: string } | null;

/** Readiness for a day's check-in, 0 to 100, from what was logged: sleep and water against the goals, energy, mood and (less) soreness. */
export function readiness(log: HealthLog | null, plan: HealthPlan): Readiness {
  if (!log) return null;
  const parts: { v: number; w: number }[] = [];
  if (log.sleepHours != null) parts.push({ v: clamp(log.sleepHours / plan.sleepGoal), w: 3 });
  if (log.water != null) parts.push({ v: clamp(log.water / plan.waterGoal), w: 2 });
  if (log.energy != null) parts.push({ v: (log.energy - 1) / 4, w: 3 });
  if (log.mood != null) parts.push({ v: (log.mood - 1) / 4, w: 1 });
  if (log.soreness != null) parts.push({ v: 1 - (log.soreness - 1) / 4, w: 3 });
  if (parts.length === 0) return null;
  const score = Math.round((parts.reduce((a, p) => a + p.v * p.w, 0) / parts.reduce((a, p) => a + p.w, 0)) * 100);
  if (score >= 75) return { score, label: "Ready to play", tone: "good", tip: "You are in good shape. A good day for a game." };
  if (score >= 50) return { score, label: "Take it easy", tone: "ok", tip: "Warm up well and drink water. Play, but do not push too hard." };
  return { score, label: "Rest day", tone: "rest", tip: "Your body needs rest. Sleep, drink water and stretch." };
}

/** Averages over the last `n` days for the summary tiles. */
export function summary(data: HealthData, n: number) {
  const days = lastDays(data, n);
  const logs = days.map((d) => d.log).filter((l): l is HealthLog => !!l);
  const num = (pick: (l: HealthLog) => number | null) => avg(logs.map(pick).filter((v): v is number => v != null));
  const games = days.reduce((a, d) => a + d.games, 0);
  const hours = data.games.filter((g) => days.some((d) => d.day === g.date)).reduce((a, g) => a + g.duration, 0);
  return {
    checkIns: logs.length,
    sleep: num((l) => l.sleepHours),
    water: num((l) => l.water),
    energy: num((l) => l.energy),
    mood: num((l) => l.mood),
    soreness: num((l) => l.soreness),
    performance: num((l) => l.performance),
    games,
    hours,
  };
}

/** Days in a row, ending today or yesterday, with a check-in. */
export function streak(data: HealthData) {
  const have = new Set(data.logs.map((l) => l.day));
  let day = have.has(data.today) ? data.today : addDays(data.today, -1);
  let n = 0;
  while (have.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Games played in each of the last `weeks` weeks (oldest first), for the bar chart. */
export function gamesByWeek(data: HealthData, weeks: number) {
  return Array.from({ length: weeks }, (_, i) => {
    const end = addDays(data.today, -7 * (weeks - 1 - i));
    const start = addDays(end, -6);
    const games = data.games.filter((g) => g.date >= start && g.date <= end);
    return { label: shortDate(start), games: games.length, hours: games.reduce((a, g) => a + g.duration, 0) };
  });
}
