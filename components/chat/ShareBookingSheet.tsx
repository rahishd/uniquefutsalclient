"use client";

import { useMemo } from "react";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { formatRs, myBookingsStore, startsAtMs, type Booking } from "@/lib/booking";

const clock = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:${t.slice(3, 5) || "00"} ${h < 12 ? "AM" : "PM"}`; };
const day = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The words that go into the chat for a booking. No phone number or name: only what a friend needs to turn up. */
export function bookingMessage(b: Booking): string {
  const paid = b.paymentStatus === "completed" ? "Paid" : b.paymentStatus === "partially_paid" ? "Part paid" : "Pay at the venue";
  return [
    `Booking ${b.code ?? ""}`.trim(),
    `${day(b.date)} · ${clock(b.startTime)} - ${clock(b.endTime)}`,
    `${b.duration} ${b.duration === 1 ? "hour" : "hours"} · ${formatRs(b.totalPrice)} · ${paid}`,
  ].join("\n");
}

// Pick one of your bookings and send its details into the chat. Upcoming games come first.
export default function ShareBookingSheet({ onPick, onClose, busy }: { onPick: (text: string) => void; onClose: () => void; busy: boolean }) {
  const store = myBookingsStore.use();
  const list = useMemo(() => {
    const now = Date.now();
    const usable = (store.data ?? []).filter((b) => b.status !== "cancelled" && b.status !== "expired");
    // only games still to come: a finished game is not worth sharing
    return usable.filter((b) => startsAtMs(b) >= now).sort((a, b) => startsAtMs(a) - startsAtMs(b));
  }, [store.data]);

  const row = (b: Booking) => (
    <li key={b.id}>
      <button type="button" disabled={busy} onClick={() => onPick(bookingMessage(b))}
        className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left disabled:opacity-60">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dbeafe] text-[#0c0b5d]"><CalendarDays size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{day(b.date)}</span>
          <span className="block text-xs text-slate-500">{clock(b.startTime)} - {clock(b.endTime)} · {formatRs(b.totalPrice)}{b.code ? ` · ${b.code}` : ""}</span>
        </span>
        {b.paymentStatus === "completed" && <Check size={16} className="shrink-0 text-emerald-600" aria-label="Paid" />}
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Share a booking" onClick={(e) => e.stopPropagation()} className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8">
        <h2 className="text-base font-semibold">Share a booking</h2>
        <p className="mt-1 text-xs text-slate-500">Pick an upcoming game and its day, time, price and code are sent in this chat.</p>

        {store.status !== "ready" && !store.data && <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading your bookings…</p>}
        {store.data && list.length === 0 && (
          <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">You have no upcoming bookings to share.</p>
        )}
        {list.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Coming up</p>
            <ul className="mt-2 space-y-2">{list.map(row)}</ul>
          </>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full rounded-2xl bg-slate-100 py-3.5 text-sm font-semibold text-slate-600">Cancel</button>
      </div>
    </div>
  );
}
