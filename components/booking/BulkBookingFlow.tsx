"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Layers, Loader2, Lock, ShieldCheck, Tag, X } from "lucide-react";
import PaymentQr from "@/components/payment/PaymentQr";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { myBookingsStore, dateKey, fetchSlotsAndClosed, formatHour, formatRs, parseKey, type Slot } from "@/lib/booking";
import {
  BULK_ADVANCE_PERCENT, BULK_MAX_HOURS, BULK_WINDOW_DAYS, bulkAmount, createBulkBooking, fetchBulkQuote,
  type BulkMode, type BulkQuote, type BulkResult, type BulkSlot,
} from "@/lib/bulk";

const PERIODS = ["Morning", "Day", "Evening"] as const;
const keyOf = (s: BulkSlot) => `${s.date} ${s.startTime}`;
const dayLabel = (k: string) => parseKey(k).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

function Steps({ step }: { step: number }) {
  const labels = ["Pick hours", "Review & pay", "Done"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <span className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-slate-200"}`} />
          <span className={i <= step ? "font-medium text-brand" : "text-slate-400"}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

export default function BulkBookingFlow() {
  const session = useSession();
  const [today] = useState(() => dateKey(new Date()));
  const days = useMemo(() => {
    const base = parseKey(today);
    return Array.from({ length: BULK_WINDOW_DAYS + 1 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [today]);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [activeDate, setActiveDate] = useState(today);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[] | "error">>({});
  const [picked, setPicked] = useState<BulkSlot[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [code, setCode] = useState("");
  const [quoteState, setQuoteState] = useState<{ key: string; q: BulkQuote | null; error: string | null } | null>(null);
  const [mode, setMode] = useState<BulkMode>("advance");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [paid, setPaid] = useState(false);

  // free hours of the day being looked at (kept, so switching days does not ask again)
  useEffect(() => {
    if (slotsByDate[activeDate]) return;
    let off = false;
    fetchSlotsAndClosed(activeDate)
      .then(({ slots }) => !off && setSlotsByDate((m) => ({ ...m, [activeDate]: slots })))
      .catch(() => !off && setSlotsByDate((m) => ({ ...m, [activeDate]: "error" })));
    return () => { off = true; };
  }, [activeDate, slotsByDate]);

  // the server prices every picked hour (and checks the promo on each hour on its own)
  const quoteKey = `${picked.map(keyOf).join("|")}#${code}`;
  useEffect(() => {
    if (step !== 1 || picked.length === 0) return;
    let off = false;
    fetchBulkQuote(picked, code)
      .then((q) => !off && setQuoteState({ key: quoteKey, q, error: null }))
      .catch((e) => !off && setQuoteState({ key: quoteKey, q: null, error: errorText(e) }));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, quoteKey]);
  const quote = quoteState?.key === quoteKey ? quoteState.q : null;
  const quoteError = quoteState?.key === quoteKey ? quoteState.error : null;

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const registered = Boolean(session.registered);
  const toggle = (s: Slot) => {
    const item = { date: activeDate, startTime: s.startTime };
    const k = keyOf(item);
    setError(null);
    setPicked((cur) => {
      if (cur.some((p) => keyOf(p) === k)) return cur.filter((p) => keyOf(p) !== k);
      if (cur.length >= BULK_MAX_HOURS) { setError(`You can pick up to ${BULK_MAX_HOURS} hours in one bulk booking.`); return cur; }
      return [...cur, item].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    });
  };

  async function confirm() {
    if (!quote || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createBulkBooking({ slots: picked, mode, promoCode: quote.promo?.ok ? quote.promo.code : undefined });
      void myBookingsStore.refresh();
      setResult(res);
    } catch (e) {
      setError(errorText(e));
      setSlotsByDate({}); // an hour may just have been taken: ask again
    } finally {
      setBusy(false);
    }
  }

  /* ---------- pay with the Fonepay QR ---------- */
  if (result && !paid) {
    const pay = result.payment;
    return (
      <div className="space-y-5 desk:mx-auto desk:max-w-2xl">
        <Steps step={1} />
        <p className="glass rounded-2xl px-4 py-3 text-sm">
          Bulk booking <span className="font-mono font-semibold">{result.code}</span>: {result.bookings.length} {result.bookings.length === 1 ? "hour" : "hours"} held for you.
          {result.restAtVenue > 0 ? ` Rs. ${result.restAtVenue.toLocaleString("en-IN")} is paid at the venue.` : ""}
        </p>
        <PaymentQr
          method={pay.method}
          orderId={pay.orderCode}
          amount={pay.amount}
          remarks={pay.remarks}
          payload={pay.qrPayload}
          expiresAt={pay.expiresAt}
          onBack={() => { setResult(null); setSlotsByDate({}); setStep(0); setPicked([]); }}
          backLabel="Cancel and start again"
          onPaid={() => { setPaid(true); setStep(2); void myBookingsStore.refresh(); }}
        />
      </div>
    );
  }

  /* ---------- done ---------- */
  if (step === 2 && result) {
    return (
      <div className="space-y-5 desk:mx-auto desk:max-w-2xl">
        <Steps step={2} />
        <div className="glass rounded-3xl p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><Check size={34} /></span>
          <h1 className="mt-4 text-2xl font-semibold">Bulk booking confirmed!</h1>
          <p className="mt-1 text-sm text-slate-500">Payment received. See you on the pitch!</p>
          <p className="mt-4 text-xs text-slate-400">Bulk booking code</p>
          <p className="font-mono text-lg font-semibold tracking-wide">{result.code}</p>
        </div>
        <section className="glass rounded-3xl p-5 text-sm">
          <ul className="space-y-2">
            {picked.map((p) => (
              <li key={keyOf(p)} className="flex justify-between gap-3"><span className="font-medium">{dayLabel(p.date)}</span><span>{formatHour(parseInt(p.startTime, 10))} – {formatHour(parseInt(p.startTime, 10) + 1)}</span></li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-white/60 pt-3">
            <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-semibold">{formatRs(result.total)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Paid now (Fonepay)</span><span className="font-semibold">{formatRs(result.payNow)}</span></div>
            {result.restAtVenue > 0 && <div className="flex justify-between"><span className="text-slate-400">To pay at the venue</span><span className="font-semibold">{formatRs(result.restAtVenue)}</span></div>}
          </div>
        </section>
        <Link href="/profile" className="glass-btn block rounded-full py-3.5 text-center text-sm font-medium text-white">View my bookings</Link>
      </div>
    );
  }

  /* ---------- review & pay ---------- */
  if (step === 1) {
    const total = quote?.total ?? 0;
    return (
      <div className="space-y-5 desk:mx-auto desk:max-w-2xl">
        <Steps step={1} />
        <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Change hours</button>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-medium">Your {picked.length} {picked.length === 1 ? "hour" : "hours"}</h2>
          {!quote && !quoteError && <div className="mt-3 h-24 animate-pulse rounded-2xl bg-white/40" aria-label="Pricing" />}
          {quoteError && <p role="alert" className="mt-3 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{quoteError}</p>}
          {quote && (
            <>
              <ul className="mt-3 divide-y divide-white/60 text-sm">
                {quote.slots.map((s) => (
                  <li key={keyOf(s)} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      <span className="block font-medium">{dayLabel(s.date)}</span>
                      <span className="text-xs text-slate-500">{formatHour(parseInt(s.startTime, 10))} – {formatHour(parseInt(s.startTime, 10) + 1)}</span>
                    </span>
                    <span className="text-right">
                      {s.discount > 0 && <span className="block text-[11px] text-slate-400 line-through">{formatRs(s.basePrice)}</span>}
                      <span className="font-semibold">{formatRs(s.total)}</span>
                      {s.promoApplied && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">promo</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5 border-t border-white/60 pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd>{formatRs(quote.subtotal)}</dd></div>
                {quote.discount > 0 && <div className="flex justify-between text-emerald-600"><dt>Discounts</dt><dd>− {formatRs(quote.discount)}</dd></div>}
                <div className="flex justify-between text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(quote.total)}</dd></div>
              </dl>
            </>
          )}
        </section>

        <section className="glass rounded-3xl p-5">
          <label htmlFor="bulk-promo" className="flex items-center gap-2 text-sm font-medium"><Tag size={16} className="text-brand" /> Promo code</label>
          <div className="mt-3 flex gap-2">
            <input id="bulk-promo" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); setCode(""); }} placeholder="e.g. DASHAIN83" autoCapitalize="characters" className="min-w-0 flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm uppercase outline-none ring-1 ring-white/80 focus:ring-brand" />
            <button type="button" onClick={() => setCode(promoInput.trim())} className="rounded-2xl bg-brand px-5 text-sm font-medium text-white">Apply</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">A promo code is applied only to the hours it is valid for (for example its days, times and limits).</p>
          {code && quote?.promo && (
            <p role="status" className={`mt-2 flex items-center gap-1 text-xs ${quote.promo.ok ? "text-emerald-600" : "text-rose-500"}`}>
              {quote.promo.ok ? <Check size={14} /> : <X size={14} />}
              {quote.promo.ok ? `${quote.promo.code} applied to ${quote.promo.appliedTo} of ${picked.length} ${picked.length === 1 ? "hour" : "hours"}` : quote.promo.message}
            </p>
          )}
        </section>

        <section className="glass rounded-3xl p-5" aria-label="How much to pay now">
          <h2 className="text-sm font-medium">How much to pay now</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([
              ["advance", `${BULK_ADVANCE_PERCENT}% advance`, "The rest is paid at the venue", bulkAmount(total, "advance")],
              ["full", "Pay in full", "Nothing left to pay later", bulkAmount(total, "full")],
            ] as const).map(([id, title, note, amount]) => (
              <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id} className={`rounded-2xl p-4 text-left transition ${mode === id ? "glass-active text-white" : "glass"}`}>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-xl font-bold">{quote ? formatRs(amount) : "…"}</span>
                <span className={`block text-[11px] ${mode === id ? "text-white/70" : "text-slate-400"}`}>{note}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="text-brand" /> Bulk bookings are paid online with Fonepay only.</p>
        </section>

        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="button" onClick={confirm} disabled={!quote || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold text-white disabled:opacity-50">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Holding your hours…</> : `Continue to Fonepay QR · ${quote ? formatRs(bulkAmount(total, mode)) : "…"}`}
        </button>
      </div>
    );
  }

  /* ---------- pick hours ---------- */
  const slots = slotsByDate[activeDate];
  const open = Array.isArray(slots) ? slots : [];
  const isPicked = (s: Slot) => picked.some((p) => p.date === activeDate && p.startTime === s.startTime);
  const perDay = (k: string) => picked.filter((p) => p.date === k).length;

  return (
    <div className="space-y-6">
      <Steps step={0} />
      <header>
        <Link href="/book" className="mb-2 flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Single booking</Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Layers size={24} className="text-brand" /> Bulk booking</h1>
        <p className="text-sm text-slate-500">Pick up to {BULK_MAX_HOURS} hours across the next {BULK_WINDOW_DAYS} days and pay once with Fonepay: {BULK_ADVANCE_PERCENT}% now or in full.</p>
      </header>

      {!registered && (
        <p className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-slate-600"><Lock size={16} /> Bulk booking needs an account.</span>
          <button type="button" onClick={openSignIn} className="font-semibold text-brand">Sign in</button>
        </p>
      )}

      <section aria-label="Select date">
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 desk:mx-0 desk:flex-wrap desk:overflow-visible desk:px-0">
          {days.map((d, i) => {
            const k = dateKey(d);
            const active = k === activeDate;
            const n = perDay(k);
            return (
              <button key={k} type="button" onClick={() => setActiveDate(k)} aria-pressed={active} className={`relative flex w-16 shrink-0 flex-col items-center rounded-2xl py-3 transition desk:w-24 desk:py-4 ${active ? "glass-active text-white" : "glass"}`}>
                <span className={`text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                <span className="text-xl font-semibold">{d.getDate()}</span>
                <span className={`text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{d.toLocaleDateString("en-US", { month: "short" })}</span>
                {n > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{n}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Select hours" className="space-y-5">
        {!slots ? (
          <div className="space-y-3" aria-label="Loading slots">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/40" />)}</div>
        ) : slots === "error" ? (
          <p role="alert" className="glass rounded-2xl px-4 py-6 text-center text-sm text-rose-600">Could not load the hours. Please try again.</p>
        ) : open.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-slate-500">No hours are open on this date. Please pick another day.</p>
        ) : (
          PERIODS.filter((p) => open.some((s) => s.period === p)).map((p) => (
            <div key={p}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{p}</h2>
              <div className="grid grid-cols-2 gap-3 desk:grid-cols-4 desk:gap-4 xl:desk:grid-cols-6">
                {open.filter((s) => s.period === p).map((s) => {
                  const on = isPicked(s);
                  return (
                    <button key={s.hour} type="button" onClick={() => toggle(s)} aria-pressed={on} className={`relative rounded-2xl px-3 py-3 text-left transition ${on ? "glass-active text-white" : "glass"}`}>
                      <span className="block text-sm font-medium">{formatHour(s.hour)}</span>
                      <span className={`text-[11px] ${on ? "text-white/70" : "text-emerald-600"}`}>{formatRs(s.price)}</span>
                      {on && <Check size={16} className="absolute right-2.5 top-2.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

      <div className="sticky bottom-24 z-10 desk:bottom-6">
        <div className="glass flex items-center justify-between gap-3 rounded-full p-2 pl-5 shadow-lg desk:max-w-xl">
          <span className="text-sm"><span className="font-semibold">{picked.length}</span> / {BULK_MAX_HOURS} hours picked</span>
          <button type="button" disabled={picked.length === 0 || !registered} onClick={() => { setError(null); setStep(1); }} className="glass-btn rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">Review &amp; pay</button>
        </div>
      </div>
    </div>
  );
}
