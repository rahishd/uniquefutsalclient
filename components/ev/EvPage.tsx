"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BatteryCharging, Loader2, QrCode, Square, Zap } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { duration, estimate, evStore, portFromAddress, startCharging, stopCharging, type EvSession } from "@/lib/ev";
import { formatRs } from "@/lib/booking";
import QrScanner from "@/components/ev/QrScanner";
import CarHero from "@/components/ev/CarHero";
import { ARRIVE_SECONDS, LEAVE_SECONDS, PLUG_SECONDS, SETTLE_SECONDS, UNPLUG_SECONDS, type SceneMode } from "@/components/ev/ChargeScene";

// after charging ends: unplug, get in and drive away, then the bay is ready for the next car
const ENDING: [SceneMode | null, number][] = [["unplugging", UNPLUG_SECONDS], ["leaving", LEAVE_SECONDS], ["arriving", ARRIVE_SECONDS], [null, 0]];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

// A running clock for the charging session, so the customer sees time and the bill growing.
function useMinutes(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(1, Math.ceil((now - new Date(startedAt).getTime()) / 60000)) : 0;
}

function Active({ s, rate, block, onStop, busy }: { s: EvSession; rate: number; block: number; onStop: () => void; busy: boolean }) {
  const mins = useMinutes(s.startedAt);
  return (
    <section aria-label="Charging now" className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#1d1c8f] to-[#3b3bd6] p-5 text-white shadow-[0_18px_36px_-18px_rgba(12,11,93,0.8)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" /></span>
        Charging now{s.port ? ` · ${s.port}` : ""}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-bold">{duration(mins)}</p><p className="text-xs text-white/70">Time</p></div>
        <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-bold">{formatRs(estimate(mins, rate, block))}</p><p className="text-xs text-white/70">So far</p></div>
      </div>
      <p className="mt-3 text-xs text-white/70">Started {when(s.startedAt)}. {formatRs(rate)} an hour, counted in {block}-minute steps. Pay at the venue after you stop.</p>
      <button type="button" disabled={busy} onClick={onStop} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-bold text-[#0c0b5d] disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Square size={15} />} Stop charging
      </button>
    </section>
  );
}

// Quick Access > EV Charging: scan the QR at a charging port to start, stop when done, and see the charging and payment history.
export default function EvPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const { data: me, status } = evStore.use();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // the animated boy follows what the customer does: Start plays "plugging" then "settling"; Stop plays "unplugging" at once
  const [phase, setPhase] = useState<SceneMode | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const play = useCallback((steps: [SceneMode | null, number][]) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let at = 0;
    for (const [m, secs] of steps) {
      timers.current.push(setTimeout(() => setPhase(m), at * 1000));
      at += secs;
    }
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // a session can also end without this screen (staff stopped or cancelled it): play the same ending once
  const activeId = me?.active?.id ?? null;
  const lastActive = useRef<string | null>(null);
  useEffect(() => {
    if (lastActive.current && !activeId && phase === null) play(ENDING);
    lastActive.current = activeId;
  }, [activeId, phase, play]);

  const begin = useCallback(async (text: string) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const s = await startCharging(text);
      setNote(`Charging started${s.port ? ` at ${s.port}` : ""}.`);
      play([["plugging", PLUG_SECONDS], ["settling", SETTLE_SECONDS], [null, 0]]);
      setCode("");
      evStore.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [play]);

  // the QR on the port is a link, so the phone's own camera opens this page with ?port=...: offer to start right away
  const [fromLink] = useState(portFromAddress);

  async function stop(id: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    play(ENDING); // he wakes up, unplugs and drives away right away
    try {
      const s = await stopCharging(id);
      setNote(`Charging stopped. ${duration(s.minutes)} · ${formatRs(s.amount)}. Please pay at the venue.${s.warning ? " " + s.warning : ""}`);
      evStore.refresh();
    } catch (e) {
      play([[null, 0]]); // nothing was stopped: back to waiting
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 pb-32 pt-6 desk:max-w-2xl desk:pb-16">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><BatteryCharging className="text-brand" /> EV Charging</h1>
        <p className="mt-1 text-sm text-slate-500">Scan the QR on a charging port to start. AC charging, {formatRs(me?.rate ?? 50)} an hour.</p>
      </header>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to charge</p>
          <p className="mt-1 text-sm text-slate-500">EV charging is for registered Unique Futsal players, so your charging and payments are saved.</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : (
        <>
          {error && <p role="alert" className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
          {note && <p role="status" className="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-700">{note}</p>}

          <CarHero mode={phase ?? (me?.active ? "charging" : "idle")} />

          {me?.active ? (
            <Active s={me.active} rate={me.rate} block={me.blockMinutes} onStop={() => stop(me.active!.id)} busy={busy} />
          ) : (
            <section aria-label="Start charging" className="rounded-3xl bg-white p-5 shadow-[0_14px_30px_-18px_rgba(12,11,93,0.35)] ring-1 ring-slate-100">
              {fromLink && (
                <button type="button" disabled={busy} onClick={() => begin(fromLink)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3.5 text-sm font-bold text-[#0c0b5d] disabled:opacity-60">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Start charging at this port
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => setScanning(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#3b3bd6] to-brand py-3.5 text-sm font-semibold text-white disabled:opacity-60">
                <QrCode size={18} /> Scan the QR to start charging
              </button>
              <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void begin(code); }}>
                <input value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="Or type the port code" autoCapitalize="characters" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand" />
                <button type="submit" disabled={busy || !code.trim()} className="rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-brand disabled:opacity-50">Start</button>
              </form>
            </section>
          )}

          {me && me.owed > 0 && (
            <p className="rounded-2xl bg-amber-400/15 p-3 text-sm text-amber-800">You owe <b>{formatRs(me.owed)}</b> for charging. Please pay at the venue.</p>
          )}

          <section aria-label="Charging and payment history">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Charging &amp; payment history</h2>
            {status === "loading" && !me && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
            {me && me.history.length === 0 && <p className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">No charging yet. Scan a port to begin.</p>}
            {me && me.history.length > 0 && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-[0_14px_30px_-18px_rgba(12,11,93,0.35)] ring-1 ring-slate-100">
                {me.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-brand"><Zap size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{h.port ?? "EV charging"} · {duration(h.minutes)}</span>
                      <span className="block text-xs text-slate-500">{when(h.startedAt ?? h.endedAt)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold">{formatRs(h.amount)}</span>
                      <span className={`block text-[11px] font-semibold ${h.status === "paid" ? "text-emerald-600" : h.status === "unpaid" ? "text-amber-600" : "text-slate-400"}`}>
                        {h.status === "paid" ? "Paid" : h.status === "unpaid" ? "Pay at venue" : "Cancelled"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {scanning && <QrScanner onClose={() => setScanning(false)} onCode={(text) => { setScanning(false); void begin(text); }} />}
    </main>
  );
}
