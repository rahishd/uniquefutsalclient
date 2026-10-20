"use client";

// The live clock of a Gamezone session, the same numbers the staff see: the booked hours run from the moment staff press Start; every
// started minute after that is charged at the session's hourly price / 60. The server sends the clock, and the final bill is always
// made by the server when staff stop the session; this only shows the live count.
import { useSyncExternalStore } from "react";
import type { GzClock } from "@/lib/gamezone";

const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) timer = setInterval(() => subs.forEach((f) => f()), 1000);
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) { clearInterval(timer); timer = undefined; }
  };
}
/** Re-renders every second and returns this device's "now" in milliseconds (to the second). */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => 0) * 1000;
}

export const WARN_MS = 5 * 60000; // the "ends in 5 minutes" warning

export interface ClockView {
  running: boolean;
  remainingMs: number; // time left of the booked hours (0 once over)
  overMs: number; // how long past the booked time
  extraMinutes: number; // started minutes past the booked time
  extraCharge: number; // Rs for those minutes
  perMinute: number; // Rs per minute
  stage: "inside" | "soon" | "over"; // soon = the last 5 minutes
  progress: number; // 0..1 of the booked time used
}

export function clockAt(c: GzClock, deviceNow: number): ClockView {
  const perMinute = c.hourlyRate / 60;
  if (c.endedAt) return { running: false, remainingMs: 0, overMs: 0, extraMinutes: c.extraMinutes, extraCharge: c.extraCharge, perMinute, stage: "inside", progress: 1 };
  const now = deviceNow + c.skewMs; // the server's time, so a wrong phone clock does not matter
  const booked = c.bookedMinutes * 60000;
  const used = Math.max(0, now - Date.parse(c.startedAt));
  const overMs = Math.max(0, used - booked);
  const extraMinutes = overMs > 0 ? Math.ceil(overMs / 60000) : 0;
  const remainingMs = Math.max(0, booked - used);
  return {
    running: true, remainingMs, overMs, extraMinutes, extraCharge: Math.round((c.hourlyRate * extraMinutes) / 60), perMinute,
    stage: used >= booked ? "over" : remainingMs <= WARN_MS ? "soon" : "inside", progress: Math.min(1, used / booked),
  };
}

const two = (n: number) => String(n).padStart(2, "0");
/** 3725000 -> "1:02:05", 65000 -> "01:05" */
export function hms(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`;
}

/** Rs per minute without a long tail: Rs. 5, Rs. 7.5 */
export const rsPerMinute = (hourlyRate: number) => `Rs. ${Math.round((hourlyRate / 60) * 10) / 10}`;
