"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Clock, Gamepad2, Loader2, X } from "lucide-react";
import CharityLine from "@/components/CharityLine";
import SessionClock from "@/components/gamezone/SessionClock";
import ShareBooking, { bookingShareText } from "@/components/ShareBooking";
import { cancelBooking, formatHour, formatRs, myBookingsStore, parseKey, startsAtMs, type Booking } from "@/lib/booking";
import { cancelGz, myGzStore, type GzBooking } from "@/lib/gamezone";
import { clockAt, useNow } from "@/lib/gz-clock";
import { METHOD_LABEL } from "@/lib/payment";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { openSignIn, useSession } from "@/lib/session";

const longDate = (key: string) => parseKey(key).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const hourOf = (t: string) => parseInt(t.split(":")[0], 10);

type State = "confirmed" | "reserved" | "waiting" | "playing" | "done" | "cancelled";
const STATE: Record<State, { title: string; note: string; tone: string }> = {
  confirmed: { title: "Booking confirmed", note: "Payment received. See you there!", tone: "bg-emerald-500/15 text-emerald-600" },
  reserved: { title: "Booking reserved", note: "Please pay at the venue when you arrive.", tone: "bg-emerald-500/15 text-emerald-600" },
  waiting: { title: "Waiting for payment", note: "Your slot is held until the payment is verified.", tone: "bg-amber-400/20 text-amber-600" },
  playing: { title: "Session in progress", note: "Your time is running. Extra minutes are charged per minute once it ends.", tone: "bg-emerald-500/15 text-emerald-600" },
  done: { title: "Completed", note: "Thanks for playing with us.", tone: "bg-sky-400/20 text-sky-600" },
  cancelled: { title: "Cancelled", note: "This booking was cancelled.", tone: "bg-rose-400/20 text-rose-600" },
};

// What a booking notification opens: the confirmation details of THAT booking (court or Gamezone), the way they were
// shown when it was made, with Share and Cancel while it is still ahead.
export default function BookingDetail({ code }: { code: string }) {
  const session = useSession();
  const courts = myBookingsStore.use();
  const gz = myGzStore.use();
  const registered = session?.registered === true;

  const loading = !session || (registered && ((!courts.data && courts.status !== "error") || (!gz.data && gz.status !== "error")));
  if (loading) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!registered) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold">Sign in to see your booking</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Booking details are only shown to the person who booked.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  const g = gz.data?.find((x) => x.code === code);
  const c = courts.data?.find((x) => (x.code ?? x.id) === code || x.id === code || (!x.code && `UF-${x.id.slice(-6).toUpperCase()}` === code));
  if (g) return <GamezoneDetail g={g} />;
  if (c) return <CourtDetail b={c} />;
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold">Booking not found</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">We could not find booking <span className="font-mono">{code}</span> on your account.</p>
      <Link href="/profile" className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">My bookings</Link>
    </div>
  );
}

function Shell({ state, id, rows, total, children }: { state: State; id: string; rows: [string, string][]; total: number; children: React.ReactNode }) {
  const s = STATE[state];
  return (
    <div className="space-y-5 pb-4 desk:mx-auto desk:max-w-2xl">
      <div className="glass rounded-3xl p-6 text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${s.tone}`}>
          {state === "cancelled" ? <X size={34} /> : state === "waiting" ? <Clock size={32} /> : state === "playing" ? <Gamepad2 size={32} /> : state === "done" ? <CalendarCheck size={32} /> : <Check size={34} />}
        </span>
        <h1 className="mt-4 text-2xl font-semibold">{s.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{s.note}</p>
        <p className="mt-4 text-xs text-slate-400">Booking ID</p>
        <p className="font-mono text-lg font-semibold tracking-wide">{id}</p>
      </div>
      <dl className="glass space-y-3 rounded-3xl p-5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4"><dt className="text-slate-400">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
        <div className="flex justify-between border-t border-white/60 pt-3 text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(total)}</dd></div>
        <CharityLine amount={total} />
      </dl>
      {children}
    </div>
  );
}

function CancelButton({ onCancel, label }: { onCancel: () => Promise<void>; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (!(await askConfirm(`Cancel this ${label}?`))) return;
    setBusy(true);
    setError(null);
    try {
      await onCancel();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
      <button type="button" onClick={go} disabled={busy} className="glass flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium text-rose-600 disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Cancel booking
      </button>
    </>
  );
}

function Back() {
  return <Link href="/profile" className="glass-btn block rounded-full py-3.5 text-center text-sm font-medium text-white">My bookings</Link>;
}

function GamezoneDetail({ g }: { g: GzBooking }) {
  const [now] = useState(() => Date.now()); // when the page opened
  const tick = useNow();
  const startsMs = startsAtMs({ date: g.date, startTime: `${g.startHour}:00` });
  const gone = g.status === "cancelled" || g.status === "expired";
  const paid = g.paymentStatus === "paid";
  // A started session shows its live clock, and its total grows with the extra minutes (the final bill is made by the venue when it is stopped)
  const live = g.clock && !g.clock.endedAt && !gone ? clockAt(g.clock, tick) : null;
  const state: State = gone ? "cancelled" : live ? "playing" : g.status === "completed" || startsMs + g.hours * 3600000 < now ? "done" : paid ? "confirmed" : g.paymentStatus === "pending" ? "waiting" : "reserved";
  const rows: [string, string][] = [
    ["Date", longDate(g.date)],
    ["Time", `${formatHour(g.startHour)} – ${formatHour(g.startHour + g.hours)} (${g.hours} hr)`],
    ["Console", g.console],
    ["Game", g.game],
    ["Players", g.players === 1 ? "Solo" : `${g.players} Players`],
    ["Payment", paid ? `Paid via ${METHOD_LABEL[g.paymentMethod] ?? "online"}` : g.paymentStatus === "pay_at_venue" ? "Pay at venue" : "Awaiting payment"],
    ...(g.clock?.endedAt && g.clock.extraMinutes > 0 ? [["Extra time", `${g.clock.extraMinutes} min · ${formatRs(g.clock.extraCharge)}`] as [string, string]] : []),
    ...(live && live.extraMinutes > 0 ? [["Extra time so far", `${live.extraMinutes} min · ${formatRs(live.extraCharge)}`] as [string, string]] : []),
  ];
  const share = bookingShareText(paid ? "🎮 Gamezone booked" : "🎮 Gamezone reserved", rows.slice(0, 4), g.code);
  return (
    <Shell state={state} id={g.code} rows={rows} total={g.total + (live?.extraCharge ?? 0)}>
      <SessionClock g={g} />
      {!gone && <ShareBooking registered text={share} />}
      {state !== "cancelled" && state !== "done" && state !== "playing" && !g.clock && startsMs > now && <CancelButton label="Gamezone session" onCancel={() => cancelGz(g.code)} />}
      <Back />
    </Shell>
  );
}

function CourtDetail({ b }: { b: Booking }) {
  const [now] = useState(() => Date.now()); // when the page opened
  const gone = b.status === "cancelled";
  const paid = b.paymentStatus === "completed";
  const venue = b.paymentMethod === "venue" && !paid;
  const startsMs = startsAtMs(b);
  const state: State = gone ? "cancelled" : b.status === "completed" || startsMs + b.duration * 3600000 < now ? "done" : paid ? "confirmed" : venue ? "reserved" : "waiting";
  const rows: [string, string][] = [
    ["Date", longDate(b.date)],
    ["Time", `${formatHour(hourOf(b.startTime))} – ${formatHour(hourOf(b.startTime) + b.duration)}`],
    ["Payment", b.totalPrice === 0 ? "Free game" : paid ? `Paid via ${METHOD_LABEL[b.paymentMethod === "full" ? "fonepay" : b.paymentMethod] ?? "online"}` : venue ? "Pay at venue" : "Awaiting payment confirmation"],
  ];
  const share = bookingShareText(paid ? "⚽ Futsal game booked" : "⚽ Futsal game reserved", rows.slice(0, 2), b.code ?? b.id);
  return (
    <Shell state={state} id={b.code ?? b.id} rows={rows} total={b.totalPrice}>
      {!gone && <ShareBooking registered text={share} />}
      {state !== "cancelled" && state !== "done" && startsMs > now && <CancelButton label="booking" onCancel={() => cancelBooking(b.id)} />}
      <Back />
    </Shell>
  );
}
