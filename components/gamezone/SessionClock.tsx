"use client";

import { Timer } from "lucide-react";
import { formatRs } from "@/lib/booking";
import type { GzBooking } from "@/lib/gamezone";
import { clockAt, hms, rsPerMinute, useNow } from "@/lib/gz-clock";

// The live clock of a started Gamezone session, shown on the booking page: time left, a warning in the last 5 minutes, and once the time is up
// the extra time and the extra price climbing every minute with the bill so far. The staff screen shows the same numbers.
export default function SessionClock({ g }: { g: GzBooking }) {
  const now = useNow();
  const c = g.clock;
  if (!c || c.endedAt) return null;
  const v = clockAt(c, now);
  const rate = rsPerMinute(c.hourlyRate);

  if (v.stage === "over") {
    return (
      <div role="timer" aria-label="Extra time" className="animate-pulse space-y-2 rounded-3xl bg-red-600 p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-90">Time is up · extra time is being charged</p>
        <div className="flex items-end justify-between gap-3">
          <p className="font-mono text-4xl font-bold tabular-nums">+{hms(v.overMs)}</p>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-90">Extra price</p>
            <p className="text-3xl font-bold tabular-nums">+{formatRs(v.extraCharge)}</p>
          </div>
        </div>
        <p className="text-sm opacity-95">{v.extraMinutes} {v.extraMinutes === 1 ? "minute" : "minutes"} at {rate} per minute · bill so far <b>{formatRs(g.total + v.extraCharge)}</b></p>
        <p className="text-xs opacity-90">Tell the staff when you finish so they can stop your session.</p>
      </div>
    );
  }

  const soon = v.stage === "soon";
  const mins = Math.max(1, Math.ceil(v.remainingMs / 60000));
  return (
    <div role="timer" aria-label="Time left" className={`space-y-3 rounded-3xl p-5 ${soon ? "bg-amber-400/20 text-amber-700" : "bg-emerald-500/15 text-emerald-700"}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide"><Timer size={13} /> {soon ? "Ending soon" : "Time left"}</p>
          <p className="font-mono text-4xl font-bold tabular-nums">{hms(v.remainingMs)}</p>
        </div>
        <p className="text-right text-xs">After your time:<br /><span className="font-semibold">{rate} per minute</span></p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${soon ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${Math.round(v.progress * 100)}%` }} /></div>
      {soon && <p className="text-sm font-medium">Your session ends in {mins} {mins === 1 ? "minute" : "minutes"}. Finish up, or extra time is charged at {rate} per minute.</p>}
    </div>
  );
}
