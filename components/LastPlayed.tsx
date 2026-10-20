"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ChevronRight, History } from "lucide-react";
import { formatHour, myBookingsStore, parseKey, startsAtMs, type Booking } from "@/lib/booking";
import { useSession } from "@/lib/session";

const noop = () => () => {};
const dayKey = () => String(Math.floor(Date.now() / 60000)); // changes each minute, so "ago" stays fresh

const hourOf = (t: string) => parseInt(t.split(":")[0], 10);
const played = (b: Booking, nowMs: number) => b.status !== "cancelled" && (b.status === "completed" || (b.status === "confirmed" && startsAtMs(b) + b.duration * 3_600_000 < nowMs));

function ago(b: Booking, nowMs: number) {
  const days = Math.floor((nowMs - startsAtMs(b)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

const shortDay = (k: string) => parseKey(k).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

// Home: the customer's last played game, and the two before it, so they can see their history at a glance.
export default function LastPlayed({ embedded = false }: { embedded?: boolean }) {
  const session = useSession();
  const tick = useSyncExternalStore(noop, dayKey, () => "");
  const bookings = myBookingsStore.use().data ?? [];
  if (!session?.registered || !tick) return null;

  const nowMs = Number(tick) * 60000;
  const games = bookings.filter((b) => played(b, nowMs)).sort((a, b) => startsAtMs(b) - startsAtMs(a));
  if (games.length === 0) return null;
  const [last, ...before] = games;

  return (
    <section aria-label="Last played" className={embedded ? "relative mt-2.5 rounded-2xl bg-white/60 px-3 py-2 text-[#0c0b5d]" : "order-1 mx-0 mt-3 rounded-3xl bg-[#dcebff] p-4 text-[#0c0b5d] desk:mt-4 desk:p-5"}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"><History size={14} /> Last played</p>
        <Link href="/profile" className="flex items-center gap-0.5 text-xs font-semibold">All games <ChevronRight size={14} /></Link>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-tight">{shortDay(last.date)}</p>
          <p className="text-sm text-[#0c0b5d]/75">{formatHour(hourOf(last.startTime))} – {formatHour(hourOf(last.startTime) + last.duration)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold">{ago(last, nowMs)}</span>
      </div>

      {before.length > 0 && (
        <ul className="mt-3 flex gap-2 border-t border-[#0c0b5d]/10 pt-3" aria-label="Earlier games">
          {before.slice(0, 2).map((b) => (
            <li key={b.id} className="min-w-0 flex-1 rounded-2xl bg-white/70 px-3 py-2">
              <p className="truncate text-xs font-semibold">{shortDay(b.date)}</p>
              <p className="truncate text-[11px] text-[#0c0b5d]/70">{formatHour(hourOf(b.startTime))} · {ago(b, nowMs)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
