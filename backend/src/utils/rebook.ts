// Quick Rebook: the weekday + hour of a customer's last game, and the open hour closest to it (pure functions).

import { weekdayOfKey } from "./dates";

export interface PastBooking {
  date: string; // YYYY-MM-DD
  hour: number; // start hour, 0-23
}

export interface LastSlot {
  weekday: number; // 0 = Sunday
  hour: number;
  date: string; // the day it was played
}

// The most recent game; two games on one day: the later hour.
export function lastPlayedSlot(history: PastBooking[]): LastSlot | null {
  const last = [...history].sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour)[0];
  return last ? { weekday: weekdayOfKey(last.date), hour: last.hour, date: last.date } : null;
}

// The free hour nearest to the wanted one (the same hour when it is free); a tie goes to the later hour.
export function nearestHour(free: number[], want: number): number | null {
  const best = [...free].sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || b - a)[0];
  return best ?? null;
}
