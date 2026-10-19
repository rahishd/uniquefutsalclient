"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Download, Loader2, ShieldCheck } from "lucide-react";
import { downloadPdf } from "@/lib/pdf";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { gameplayStore, paymentsStore, profileStore, type PaymentItem } from "@/lib/profile";
import { cancelBooking, formatHour, myBookingsStore, parseKey, startsAtMs, type Booking } from "@/lib/booking";
import { cancelGz, myGzStore, type GzBooking } from "@/lib/gamezone";

export const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

// One row in "My bookings": a court booking or a Gamezone session.
export interface Item {
  id: string;
  code: string; // short booking code shown to the customer
  kind: "game" | "gamezone";
  dateKey: string;
  date: string;
  time: string;
  what: string;
  amount: number;
  payment: "Paid" | "Pay at venue" | "Payment pending" | "Free game";
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  upcoming: boolean;
  bulk?: string; // BLK-XXXXXX when this game was booked with Bulk Booking
}

const dayLabel = (key: string) => parseKey(key).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const hourOf = (t: string) => parseInt(t.split(":")[0], 10);
const range = (a: number, b: number) => `${formatHour(a)} – ${formatHour(b)}`;
const cap = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)) as Item["status"];
const bulkCodeOf = (b: Booking) => /^BULK:(BLK-[A-Z0-9]+)/.exec(b.notes ?? "")?.[1];

function courtItem(b: Booking, now: number): Item {
  const paid = b.paymentStatus === "completed";
  const bulk = bulkCodeOf(b);
  return {
    bulk,
    id: b.id,
    code: b.code ?? b.id,
    kind: "game",
    dateKey: b.date,
    date: dayLabel(b.date),
    time: range(hourOf(b.startTime), hourOf(b.startTime) + b.duration),
    what: bulk ? "Bulk booking game" : "Court booking",
    amount: b.totalPrice,
    payment: paid ? (b.totalPrice === 0 ? "Free game" : "Paid") : b.paymentMethod === "venue" ? "Pay at venue" : "Payment pending",
    status: cap(b.status),
    upcoming: b.status !== "cancelled" && b.status !== "completed" && startsAtMs(b) + 3600000 > now,
  };
}

function gzItem(g: GzBooking, now: number): Item {
  const d = parseKey(g.date);
  d.setHours(g.startHour, 0, 0, 0);
  const active = g.status === "confirmed";
  return {
    id: g.code,
    code: g.code,
    kind: "gamezone",
    dateKey: g.date,
    date: dayLabel(g.date),
    time: range(g.startHour, g.startHour + g.hours),
    what: `PS5 · ${g.game}`,
    amount: g.total,
    payment: g.paymentStatus === "paid" ? "Paid" : g.paymentStatus === "pay_at_venue" ? "Pay at venue" : "Payment pending",
    status: g.status === "cancelled" || g.status === "expired" ? "Cancelled" : d.getTime() + g.hours * 3600000 < now ? "Completed" : "Confirmed",
    upcoming: active && d.getTime() + g.hours * 3600000 > now,
  };
}

type BulkGroup = { code: string; rows: Item[]; upcoming: number; total: number };
type PayRow = { bulk: false; p: PaymentItem } | { bulk: true; code: string; n: number; amount: number; date: string; statuses: Set<string> };

// The payment state of a whole bulk booking.
export function bulkStatus(g: { rows: Item[] }) {
  const live = g.rows.filter((r) => r.status !== "Cancelled");
  if (live.length === 0) return "Cancelled";
  if (live.some((r) => r.payment === "Payment pending")) return "Payment pending";
  return live.every((r) => r.payment === "Paid") ? "Paid" : "Part paid";
}

/**
 * Everything the Profile record cards and their detail pages show, worked out once: court bookings and Gamezone sessions as rows,
 * the games of each Bulk Booking grouped under its code, games played, and payments (one row per bulk booking).
 * Returns null until the data and the clock are ready.
 */
export function useRecords() {
  const courts = myBookingsStore.use().data;
  const sessions = myGzStore.use().data;
  const paymentsData = paymentsStore.use().data;
  const gameplay = gameplayStore.use().data ?? null;
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);
  if (!now) return null;

  const items: Item[] = [...(courts ?? []).map((b) => courtItem(b, now)), ...(sessions ?? []).map((g) => gzItem(g, now))];
  const upcomingList = items.filter((b) => b.upcoming).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const pastList = items.filter((b) => !b.upcoming).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const ownUpcoming = upcomingList.filter((b) => !b.bulk);
  const ownPast = pastList.filter((b) => !b.bulk);
  // Bulk Booking games, grouped by the bulk code they were booked under; groups with a game still to play come first.
  const bulkGroups: BulkGroup[] = Object.values(items.filter((b) => b.bulk).reduce<Record<string, { code: string; rows: Item[] }>>((m, b) => { (m[b.bulk!] ??= { code: b.bulk!, rows: [] }).rows.push(b); return m; }, {}))
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time)), upcoming: g.rows.filter((r) => r.upcoming).length, total: g.rows.filter((r) => r.status !== "Cancelled").reduce((n, r) => n + r.amount, 0) }))
    .sort((a, b) => (b.upcoming > 0 ? 1 : 0) - (a.upcoming > 0 ? 1 : 0) || b.rows[b.rows.length - 1].dateKey.localeCompare(a.rows[a.rows.length - 1].dateKey));
  // Games played: completed bookings.
  const played = pastList.filter((b) => b.status === "Completed");
  const playedOwn = played.filter((b) => !b.bulk);
  const bulkPlayed = bulkGroups.map((g) => ({ ...g, done: g.rows.filter((r) => r.status === "Completed").length })).filter((g) => g.done > 0);
  // The payments of one bulk booking are one row (matched by the booking code of each game).
  const bulkByCode = new Map(items.filter((b) => b.bulk).map((b) => [b.code, b.bulk!]));
  const payRows: PayRow[] = [];
  const bulkPayRows = new Map<string, Extract<PayRow, { bulk: true }>>();
  for (const p of paymentsData ?? []) {
    const bc = p.kind === "game" ? bulkByCode.get(p.code) : undefined;
    if (!bc) { payRows.push({ bulk: false, p }); continue; }
    let row = bulkPayRows.get(bc);
    if (!row) { row = { bulk: true, code: bc, n: 0, amount: 0, date: p.date, statuses: new Set() }; bulkPayRows.set(bc, row); payRows.push(row); }
    row.n += 1; row.amount += p.amount; row.statuses.add(p.status);
    if (p.date > row.date) row.date = p.date;
  }

  return {
    items, upcomingList, pastList, ownUpcoming, ownPast, bulkGroups, played, playedOwn, bulkPlayed, payRows, gameplay, payments: paymentsData ?? [],
    summary: {
      bookings: `${ownUpcoming.length} upcoming · ${items.filter((b) => !b.bulk).length} in all`,
      bulk: bulkGroups.length === 0 ? "No bulk bookings yet" : `${bulkGroups.length} ${bulkGroups.length === 1 ? "booking" : "bookings"} · ${bulkGroups.filter((g) => g.upcoming > 0).length} with games to play`,
      games: `${played.length} played`,
      payments: `${payRows.length} ${payRows.length === 1 ? "transaction" : "transactions"}`,
    },
  };
}

export type Section = "bookings" | "bulk" | "games" | "payments";
const TITLE: Record<Section, string> = { bookings: "My bookings", bulk: "Bulk Booking", games: "Games played", payments: "Payment history" };

// The detail page of one Profile record card: everything in that list, with the PDF download.
export default function ProfileRecords({ section }: { section: Section }) {
  const session = useSession();
  const profile = profileStore.use().data ?? null;
  const r = useRecords();
  const statsById = new Map((r?.gameplay?.games ?? []).map((g) => [g.id, g]));
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [bulkTab, setBulkTab] = useState<"up" | "past" | null>(null); // null = Upcoming if any, else Previous
  const [openBulk, setOpenBulk] = useState<Set<string>>(new Set()); // bulk bookings that are expanded
  const [payTab, setPayTab] = useState<"paid" | "unpaid">("paid");
  const [gameTab, setGameTab] = useState<"up" | "past">("past");
  const [bookTab, setBookTab] = useState<"up" | "past" | null>(null); // null = first one that has bookings

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!session.registered) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-sm text-slate-500">Sign in to see your records.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }
  if (!r) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  async function cancel(it: Item) {
    setCancelError(null);
    try {
      if (it.kind === "game") await cancelBooking(it.id);
      else await cancelGz(it.id);
      setCancelId(null);
    } catch (e) {
      setCancelError(errorText(e));
    }
  }

  async function exportPdf() {
    if (!r) return;
    setPdfBusy(true);
    try {
      const who = profile ? `${profile.name} · ${profile.phone} · ID ${profile.customerCode}` : "";
      if (section === "bookings") {
        await downloadPdf({
          filename: "unique-futsal-bookings.pdf",
          title: "My bookings",
          lines: [who],
          columns: [{ header: "Date", width: 95 }, { header: "Time", width: 105 }, { header: "What", width: 90 }, { header: "Booking ID", width: 85 }, { header: "Amount", width: 55 }, { header: "Payment", width: 45 }, { header: "Status", width: 40 }],
          rows: [...r.upcomingList, ...r.pastList].map((b) => [b.date, b.time, b.what, b.code, rs(b.amount), b.payment, b.status]),
        });
      } else if (section === "games") {
        await downloadPdf({
          filename: "unique-futsal-games.pdf",
          title: "Games played",
          lines: [who, `Played ${r.played.length}`],
          columns: [{ header: "Date", width: 120 }, { header: "Time", width: 130 }, { header: "What", width: 170 }, { header: "Booking ID", width: 95 }],
          rows: r.played.map((b) => [b.date, b.time, b.what, b.code]),
        });
      } else if (section === "payments") {
        await downloadPdf({
          filename: "unique-futsal-payments.pdf",
          title: "Payment history",
          lines: [who, "To check a bill, type its Verification code at the Verify Documents page of the Unique Futsal app."],
          columns: [{ header: "Date", width: 85 }, { header: "Booking ID", width: 140 }, { header: "Amount", width: 85 }, { header: "Status", width: 70 }, { header: "Verify code", width: 135 }],
          rows: r.payments.map((p) => [dayLabel(p.date), p.kind === "bill" ? `${p.code} (bill)` : p.code, rs(p.amount), p.status, p.verifyCode ?? ""]),
        });
      }
    } finally {
      setPdfBusy(false);
    }
  }

  function renderBooking(b: Item, tag?: string) {
    return (
      <li key={b.id} className="rounded-2xl bg-white/60 p-4 text-sm">
        {tag && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand">{tag}</p>}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{b.date}</p>
            <p className="text-slate-500">{b.time} · {b.what}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${b.status === "Cancelled" ? "bg-rose-500/10 text-rose-500" : b.status === "Completed" ? "bg-slate-200 text-slate-500" : "bg-emerald-500/10 text-emerald-600"}`}>{b.status}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">{b.code}</span>
          <span>{rs(b.amount)} · {b.payment}</span>
        </div>
        {b.upcoming && (
          cancelId === b.id ? (
            <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-700">
              <p>Cancelling is free. If you already paid online, the venue returns the full amount to you.</p>
              {cancelError && <p role="alert" className="mt-2 font-medium">{cancelError}</p>}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { setCancelId(null); setCancelError(null); }} className="flex-1 rounded-full bg-white py-2 font-medium">Keep booking</button>
                <button type="button" onClick={() => cancel(b)} className="flex-1 rounded-full bg-rose-500 py-2 font-medium text-white">Confirm cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setCancelId(b.id); setCancelError(null); }} className="mt-3 text-xs font-medium text-rose-500">Cancel booking</button>
          )
        )}
      </li>
    );
  }

  function renderBulkGroup(g: BulkGroup) {
    const open = openBulk.has(g.code);
    const short = (k: string) => parseKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const first = g.rows[0]?.dateKey;
    const last = g.rows[g.rows.length - 1]?.dateKey;
    const heading = !first ? g.code : first === last ? short(first) : `${short(first)} – ${short(last)}`;
    return (
      <li key={g.code} className="rounded-2xl bg-white/40 p-3">
        <button type="button" aria-expanded={open} onClick={() => setOpenBulk((s) => { const n = new Set(s); if (n.has(g.code)) n.delete(g.code); else n.add(g.code); return n; })} className="flex w-full items-center justify-between gap-3 px-1 text-left">
          <span className="min-w-0">
            <span className="block text-base font-semibold">{heading}</span>
            <span className="block text-xs text-slate-500"><span className="font-mono">{g.code}</span> · {g.rows.length} {g.rows.length === 1 ? "game" : "games"} · {rs(g.total)} · {bulkStatus(g)}</span>
          </span>
          <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <ul className="mt-3 space-y-2">{g.rows.map((row) => renderBooking(row))}</ul>}
      </li>
    );
  }

  function renderGame(b: Item) {
    return (
      <li key={b.id} className="rounded-2xl bg-white/60 px-4 py-3">
        <span className="block font-medium">{b.date}</span>
        <span className="text-xs text-slate-500">{b.time} · {b.what}</span>
        {statsById.get(b.id)?.goals != null && (
          <span className="mt-1 block text-xs font-medium text-brand">Goals {statsById.get(b.id)?.goals} · Assists {statsById.get(b.id)?.assists}</span>
        )}
      </li>
    );
  }

  function renderPayment(p: PaymentItem) {
    return (
      <li key={p.id} className="flex flex-wrap items-center justify-between py-3 first:pt-0 last:pb-0">
        <span><span className="block font-medium">{dayLabel(p.date)}</span><span className="font-mono text-[11px] text-slate-400">{p.code}</span></span>
        <span className="text-right"><span className="block font-medium">{rs(p.amount)}</span><span className="text-[11px] text-emerald-600">{p.status}</span></span>
        {p.verifyCode && (
          <span className="mt-2 flex w-full basis-full items-center justify-between rounded-xl bg-[#0c0b5d]/5 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-[#0c0b5d]"><ShieldCheck size={14} aria-hidden /> Verification code <b className="font-mono text-sm tracking-widest">{p.verifyCode}</b></span>
            <Link href={`/verify?code=${p.verifyCode}`} className="font-semibold text-brand underline">Verify</Link>
          </span>
        )}
        {p.kind === "bill" && p.lines && (
          <span className="mt-2 block w-full basis-full text-xs text-slate-500">
            {p.lines.map((l, i) => <span key={i} className="flex justify-between"><span>{l.type === "goods" && l.quantity > 1 ? `${l.quantity} x ` : ""}{l.label}</span><span>{rs(l.amount)}</span></span>)}
            {!!p.points && <span className="mt-1 block font-medium text-amber-600">+{p.points} loyalty points</span>}
          </span>
        )}
      </li>
    );
  }

  function renderPayRow(row: PayRow) {
    if (!row.bulk) return renderPayment(row.p);
    const status = row.statuses.size === 1 ? [...row.statuses][0] : "Part paid";
    return (
      <li key={`bulk-${row.code}`} className="flex flex-wrap items-center justify-between py-3 first:pt-0 last:pb-0">
        <span><span className="block font-medium">Bulk Booking</span><span className="font-mono text-[11px] text-slate-400">{row.code} · {row.n} {row.n === 1 ? "game" : "games"} · {dayLabel(row.date)}</span></span>
        <span className="text-right"><span className="block font-medium">{rs(row.amount)}</span><span className="text-[11px] text-emerald-600">{status}</span></span>
      </li>
    );
  }

  const empty = (text: string) => <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
  const hasPdf = section !== "bulk";

  return (
    <div className="space-y-5 pb-4 desk:mx-auto desk:max-w-3xl">
      <Link href="/profile" className="flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Profile</Link>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{TITLE[section]}</h1>
          <p className="text-sm text-slate-500">{r.summary[section]}</p>
        </div>
        {hasPdf && (
          <button type="button" onClick={exportPdf} disabled={pdfBusy} aria-label={`Download ${TITLE[section]} as PDF`} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-xs font-medium text-brand disabled:opacity-50">
            {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
          </button>
        )}
      </header>

      <section className="glass rounded-3xl p-5">
        {section === "bookings" && (r.ownUpcoming.length + r.ownPast.length === 0 ? empty("No bookings yet.") : (
          (() => {
            const tab = bookTab ?? (r.ownUpcoming.length > 0 ? "up" : "past");
            const list = tab === "up" ? r.ownUpcoming : r.ownPast;
            return (
              <div className="space-y-4">
                <div role="tablist" className="grid grid-cols-2 gap-2">
                  {([["up", "Coming up", r.ownUpcoming.length], ["past", "Earlier", r.ownPast.length]] as const).map(([k, label, n]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setBookTab(k)} className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${tab === k ? "bg-brand text-white" : "bg-white/70 text-slate-600"}`}>{label} ({n})</button>
                  ))}
                </div>
                {list.length === 0 ? empty(tab === "up" ? "Nothing coming up." : "No earlier bookings.") : <ul className="space-y-3">{list.map((b) => renderBooking(b))}</ul>}
              </div>
            );
          })()
        ))}

        {section === "bulk" && (r.bulkGroups.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">
            <p>No bulk bookings yet.</p>
            <Link href="/book/bulk" className="mt-2 inline-block font-medium text-brand">Book several games at once</Link>
          </div>
        ) : (
          (() => {
            const ups = r.bulkGroups.filter((g) => g.upcoming > 0);
            const prev = r.bulkGroups.filter((g) => g.upcoming === 0);
            const tab = bulkTab ?? (ups.length > 0 ? "up" : "past");
            const list = tab === "up" ? ups : prev;
            return (
              <div className="space-y-4">
                <div role="tablist" className="grid grid-cols-2 gap-2">
                  {([["past", "Previous", prev.length], ["up", "Upcoming", ups.length]] as const).map(([k, label, n]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setBulkTab(k)} className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${tab === k ? "bg-brand text-white" : "bg-white/70 text-slate-600"}`}>{label} ({n})</button>
                  ))}
                </div>
                {list.length === 0 ? empty(tab === "up" ? "Nothing upcoming." : "No previous bulk bookings.") : <ul className="space-y-3">{list.map(renderBulkGroup)}</ul>}
                <Link href="/book/bulk" className="inline-block text-xs font-medium text-brand">+ New bulk booking</Link>
              </div>
            );
          })()
        ))}

        {section === "games" && (
          <div className="space-y-4">
            <div role="tablist" className="grid grid-cols-2 gap-2">
              {([["up", "Coming up", r.upcomingList.length], ["past", "Earlier", r.played.length]] as const).map(([k, label, n]) => (
                <button key={k} type="button" role="tab" aria-selected={gameTab === k} onClick={() => setGameTab(k)} className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${gameTab === k ? "bg-brand text-white" : "bg-white/70 text-slate-600"}`}>{label} ({n})</button>
              ))}
            </div>
            {gameTab === "up" ? (r.upcomingList.length === 0 ? empty("Nothing coming up.") : <ul className="space-y-3">{r.upcomingList.map((b) => renderBooking(b))}</ul>) : r.played.length === 0 ? empty("No games yet.") : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white/60 py-3"><dd className="text-lg font-semibold">{r.played.length}</dd><dt className="text-[11px] text-slate-400">Games played</dt></div>
              <div className="rounded-2xl bg-white/60 py-3"><dd className="text-lg font-semibold">{r.upcomingList.length}</dd><dt className="text-[11px] text-slate-400">Coming up</dt></div>
              {r.gameplay && r.gameplay.totals.withStats > 0 && (
                <>
                  <div className="rounded-2xl bg-white/60 py-3"><dd className="text-lg font-semibold">{r.gameplay.totals.goals}</dd><dt className="text-[11px] text-slate-400">Goals</dt></div>
                  <div className="rounded-2xl bg-white/60 py-3"><dd className="text-lg font-semibold">{r.gameplay.totals.assists}</dd><dt className="text-[11px] text-slate-400">Assists</dt></div>
                </>
              )}
            </dl>
            {r.playedOwn.length > 0 && <ul className="space-y-2 text-sm">{r.playedOwn.map((g) => renderGame(g))}</ul>}
            {r.bulkPlayed.length > 0 && (
              <ul className="space-y-2 text-sm">
                {r.bulkPlayed.map((g) => (
                  <li key={g.code} className="rounded-2xl bg-white/60 px-4 py-3">
                    <span className="flex items-center justify-between gap-2"><span className="font-medium">Bulk Booking</span><span className="text-xs text-slate-500">{bulkStatus(g)}</span></span>
                    <span className="block text-xs text-slate-500"><span className="font-mono">{g.code}</span> · {g.done} {g.done === 1 ? "game" : "games"} played</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-400">Goals and assists are recorded by the venue for games played from now on. Team results from challenge games are on the Opponent page (Captain mode).</p>
          </div>
            )}
          </div>
        )}

        {section === "payments" && (() => {
          const unpaid = r.items.filter((b) => b.status !== "Cancelled" && (b.payment === "Pay at venue" || b.payment === "Payment pending"));
          return (
            <div className="space-y-4">
              <div role="tablist" className="grid grid-cols-2 gap-2">
                {([["paid", "Paid", r.payRows.length], ["unpaid", "Unpaid", unpaid.length]] as const).map(([k, label, n]) => (
                  <button key={k} type="button" role="tab" aria-selected={payTab === k} onClick={() => setPayTab(k)} className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${payTab === k ? "bg-brand text-white" : "bg-white/70 text-slate-600"}`}>{label} ({n})</button>
                ))}
              </div>
              {payTab === "paid"
                ? (r.payRows.length === 0 ? empty("No payments yet.") : <ul className="divide-y divide-white/70 text-sm">{r.payRows.map(renderPayRow)}</ul>)
                : (unpaid.length === 0 ? empty("Nothing to pay.") : (
                  <ul className="divide-y divide-white/70 text-sm">
                    {unpaid.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center justify-between py-3 first:pt-0 last:pb-0">
                        <span><span className="block font-medium">{b.date}</span><span className="font-mono text-[11px] text-slate-400">{b.code} · {b.time}</span></span>
                        <span className="text-right"><span className="block font-medium">{rs(b.amount)}</span><span className="text-[11px] text-amber-600">{b.payment}</span></span>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
