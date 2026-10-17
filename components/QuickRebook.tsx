"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { formatHour, formatRs, parseKey, rebookStore } from "@/lib/booking";
import { useSession } from "@/lib/session";

// "Book again": the server takes the weekday + hour of the customer's last game and offers the next such weekday, at the
// same hour or, when that hour is taken, the nearest open hour (GET /bookings/me/rebook). Nothing for a new customer.
export default function QuickRebook() {
  const session = useSession();
  const view = rebookStore.use().data ?? null;

  // Only offer "Book again" when a time that day is actually open. Guests have no booking history.
  if (!session?.registered || !view || !view.target.available || !view.target.date) return null;
  const { usual, target } = view;

  const day = parseKey(target.date!);
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" });
  const nextDate = day.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const hour = target.hour ?? usual.hour;
  const moved = hour !== usual.hour; // the last game's hour is taken, this is the nearest open one
  const href = `/book?date=${target.date}&hour=${hour}`;

  return (
    <section aria-label="Quick rebook" className="mt-6 rounded-3xl bg-[#0c0b5d] p-5 text-white shadow-[0_14px_34px_-14px_rgba(12,11,93,0.7)]">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white">
        <Zap size={14} className="fill-current" /> Book again
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-semibold leading-tight text-white">{weekday}</p>
          <p className="text-sm text-white/80">
            {formatHour(hour)} – {formatHour(hour + 1)}
          </p>
        </div>
        <p className="text-xl font-semibold text-white">{formatRs(target.price ?? 0)}</p>
      </div>

      <p className="mt-2 text-xs text-white/75">
        {moved ? `${formatHour(usual.hour)} is taken · nearest open time` : "Same time as your last game"} · next {nextDate}
      </p>

      <Link
        href={href}
        className="mt-4 flex items-center justify-center gap-2 rounded-full bg-sky-100 py-3.5 text-sm font-semibold tracking-wide text-[#0c0b5d] shadow-sm transition hover:bg-sky-50"
      >
        BOOK AGAIN <ArrowRight size={16} />
      </Link>
    </section>
  );
}
