"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { dayOfWeek, healthStore, hourLabel } from "@/lib/health";

const DONE_KEY = "uf-health-reminder"; // the day this reminder was closed on this device

// Home: on a play day from the customer's health plan, once the reminder hour has come and they have no game booked or played
// that day, a card asks them to book. "Not today" hides it until tomorrow.
export default function HealthReminder({ className = "" }: { className?: string }) {
  const session = useSession();
  const { data } = healthStore.use();
  const [closed, setClosed] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(DONE_KEY) ?? ""; } catch { return ""; }
  });
  if (!session?.registered || !data || !data.plan.remind) return null;

  const today = data.today;
  if (closed === today || !data.plan.playDays.includes(dayOfWeek(today))) return null;
  if (new Date().getHours() < data.plan.remindHour) return null;
  if (data.games.some((g) => g.date === today)) return null;

  function close() {
    try { localStorage.setItem(DONE_KEY, today); } catch { /* storage blocked */ }
    setClosed(today);
  }

  return (
    <section aria-label="Play day reminder" className={`flex items-center gap-3 rounded-2xl border border-[#bfd7ff] bg-white p-3 text-black shadow-sm ring-2 ring-white/80 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ff]"><CalendarCheck size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">Today is your play day</p>
        <p className="text-xs text-slate-700">Booked nothing yet? Reminder set for {hourLabel(data.plan.remindHour)}.</p>
      </div>
      <Link href="/book" className="shrink-0 rounded-full bg-[#0c0b5d] px-3.5 py-2 text-xs font-semibold text-white">Book now</Link>
      <button type="button" onClick={close} aria-label="Not today" className="shrink-0 rounded-full p-1.5 text-slate-600"><X size={16} /></button>
    </section>
  );
}
