"use client";

import { useCallback, useEffect, useState } from "react";
import { Accessibility, CheckCircle2, Loader2, UserRound } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { markReadByTypes } from "@/lib/notifications";
import { FALLBACK_OPTIONS, STATUS_TEXT, cancelRequest, loadMine, loadOptions, sendRequest, type WheelchairOptions, type WheelchairRequest } from "@/lib/wheelchair";

const nepalToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
const addDays = (key: string, n: number) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const day = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const clock = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`; };

const field = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

export default function WheelchairPage() {
  const session = useSession();
  const [opts, setOpts] = useState<WheelchairOptions>(FALLBACK_OPTIONS);
  const [mine, setMine] = useState<WheelchairRequest[] | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<WheelchairRequest | null>(null);

  const registered = session?.registered === true;
  const today = nepalToday();

  useEffect(() => {
    let live = true;
    loadOptions().then((o) => live && setOpts(o)).catch(() => {});
    return () => { live = false; };
  }, []);

  const refresh = useCallback(() => loadMine().then(setMine).catch(() => setMine([])), []);
  useEffect(() => {
    if (!registered) return;
    let live = true;
    loadMine().then((m) => live && setMine(m)).catch(() => live && setMine([]));
    markReadByTypes(["wheelchair"]); // opening this page clears the badge for replies
    return () => { live = false; };
  }, [registered]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!date) return setError("Choose the day you are coming.");
    if (!time) return setError("Choose about what time you are coming.");
    setBusy(true);
    try {
      const r = await sendRequest({ date, time, people, note: note.trim() || undefined, bookingCode: bookingCode.trim() || undefined });
      setSent(r);
      setDate("");
      setTime("");
      setPeople(1);
      setNote("");
      setBookingCode("");
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setCancelling(id);
    setError(null);
    try {
      await cancelRequest(id);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setCancelling(null);
    }
  }

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Wheelchair Request</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in so the venue can get ready for you and let you know when it is confirmed.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Request sent</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          Your reference is <strong className="font-mono text-slate-700">{sent.code}</strong>. The venue will confirm it here and in your notifications.
        </p>
        <button type="button" onClick={() => setSent(null)} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">See my requests</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 desk:mx-auto desk:max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Wheelchair Request</h1>
        <p className="text-sm text-slate-500">Coming with a wheelchair? Tell us when, and we will have the ramp, a court-side space and a helping hand ready.</p>
      </header>

      <form onSubmit={submit} className="glass space-y-5 rounded-3xl p-5" aria-label="New wheelchair request">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Day
            <input type="date" value={date} min={today} max={addDays(today, opts.daysAhead)} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="block text-sm font-medium">About what time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </label>
        </div>

        <label className="block text-sm font-medium">How many wheelchair users
          <select value={people} onChange={(e) => setPeople(Number(e.target.value))} className={field}>
            {Array.from({ length: opts.maxPeople }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="block text-sm font-medium">Anything we should know <span className="font-normal text-slate-400">(optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={opts.noteMax} placeholder="For example: need help from the car park, or a seat near the court."
            className={field} />
          <span className="mt-1 block text-right text-xs font-normal text-slate-400">{note.length} / {opts.noteMax}</span>
        </label>

        <label className="block text-sm font-medium">Booking code <span className="font-normal text-slate-400">(optional)</span>
          <input value={bookingCode} onChange={(e) => setBookingCode(e.target.value.toUpperCase())} maxLength={20} placeholder="e.g. UF-7K3QX9"
            className={`${field} font-mono placeholder:font-sans`} />
        </label>

        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="submit" disabled={busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : "Send request"}
        </button>
        <p className="text-center text-xs text-slate-400">Up to {opts.daysAhead} days ahead, {opts.perDay} requests a day. For something urgent, call the venue.</p>
      </form>

      <section aria-label="My wheelchair requests" className="space-y-3">
        <h2 className="text-lg font-medium">My requests</h2>
        {mine === null && <div className="h-24 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
        {mine?.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
            <Accessibility size={28} className="text-slate-400" />
            You have not sent any wheelchair requests.
          </div>
        )}
        <ul className="space-y-3">
          {mine?.map((r) => {
            const st = STATUS_TEXT[r.status] ?? STATUS_TEXT.pending;
            const canCancel = r.status === "pending" || r.status === "confirmed";
            return (
              <li key={r.id} data-hl={`wc-${r.id}`} className="glass space-y-2 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{day(r.date)} · {clock(r.time)}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <p className="text-xs text-slate-400">
                  <span className="font-mono">{r.code}</span> · {r.people} wheelchair {r.people === 1 ? "user" : "users"}{r.bookingCode ? ` · booking ${r.bookingCode}` : ""}
                </p>
                {r.note && <p className="whitespace-pre-line text-sm text-slate-600">{r.note}</p>}
                {r.staffReply && (
                  <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm">
                    <p className="text-xs font-semibold text-brand">Reply from the venue</p>
                    <p className="mt-1 whitespace-pre-line text-slate-700">{r.staffReply}</p>
                  </div>
                )}
                {canCancel && (
                  <button type="button" onClick={() => cancel(r.id)} disabled={cancelling === r.id} className="text-xs font-semibold text-rose-600 disabled:opacity-60">
                    {cancelling === r.id ? "Cancelling…" : "Cancel this request"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
