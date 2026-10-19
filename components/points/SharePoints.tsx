"use client";

import { useState } from "react";
import { Check, CheckCircle2, Loader2, Send, UserRound, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { FALLBACK_SHARE, findShareFriend, sharePoints, type Loyalty } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";

const input = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

// Send some of your points to a friend who has an account in the app. The server checks the friend and the balance.
export default function SharePoints({ loy, onClose }: { loy: Loyalty; onClose: () => void }) {
  const rules = loy.share ?? FALLBACK_SHARE;
  const amount = rules.max; // every share sends the same fixed amount
  const locked = loy.remaining < rules.minBalance; // sharing opens once you have enough points
  const [phone, setPhone] = useState("");
  const [friend, setFriend] = useState<{ phone: string; firstName: string } | null>(null);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ points: number; to: string } | null>(null);

  const pointsOk = Math.floor(loy.remaining) >= amount;

  async function find() {
    setError(null);
    setFinding(true);
    try {
      setFriend(await findShareFriend(phone));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setFinding(false);
    }
  }

  async function send() {
    if (!friend || !pointsOk) return;
    setError(null);
    setBusy(true);
    try {
      const r = await sharePoints(friend.phone, amount);
      setSent({ points: r.points, to: r.to });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="glass rounded-3xl p-5 text-center desk:col-span-2" aria-label="Points shared" role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={30} /></span>
        <h2 className="mt-3 text-base font-semibold">Points shared</h2>
        <p className="mt-1 text-sm text-slate-500">{fmtPts(sent.points)} points were sent to {sent.to}. We let them know in the app.</p>
        <button type="button" onClick={onClose} className="glass-btn mt-4 rounded-full px-8 py-3 text-sm font-semibold text-white">Done</button>
      </section>
    );
  }

  return (
    <section className="glass rounded-3xl p-5 desk:col-span-2" aria-label="Share points with a friend">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Send size={18} className="text-brand" /> Share points with a friend</h2>
          <p className="mt-1 text-xs text-slate-500">Your friend needs an account in this app. Points keep the same expiry date, and you can share up to {rules.perDay} times a day.</p>
          <p className="mt-1 text-xs font-medium text-slate-600">You need at least {rules.minBalance} points to share, and every share sends {amount} points.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/70 p-2 text-slate-500"><X size={16} /></button>
      </div>

      {locked ? (
        <p className="mt-4 rounded-2xl bg-white/60 px-3 py-3 text-sm text-slate-500">Sharing opens when you have at least {rules.minBalance} points. You have {fmtPts(loy.remaining)}, so {fmtPts(Math.max(0, rules.minBalance - loy.remaining))} more to go.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-4 space-y-5">
          <div>
            <label className="block text-sm font-medium">1. Your friend&apos;s mobile number
              <div className="flex gap-2">
                <input value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setFriend(null); }} inputMode="numeric" autoComplete="off" placeholder="98XXXXXXXX" className={input} />
                <button type="button" onClick={find} disabled={phone.length !== 10 || finding || !!friend} className="mt-2 shrink-0 rounded-2xl bg-[#0c0b5d] px-4 text-sm font-semibold disabled:opacity-50" style={{ color: "#ffffff" }}>
                  {finding ? <Loader2 size={16} className="animate-spin" /> : "Find"}
                </button>
              </div>
            </label>
            {friend && <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700"><UserRound size={16} /> Sharing with {friend.firstName} <Check size={16} /></p>}
          </div>

          {friend && (
            <div>
              <p className="text-sm font-medium">2. Points to send</p>
              <p className="mt-2 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-black/5">{amount} points, the same every time</p>
              {!pointsOk && <p className="mt-1 text-xs text-rose-600">You need at least {amount} points to send.</p>}
            </div>
          )}

          {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>}

          <button type="submit" disabled={!friend || !pointsOk || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {friend && pointsOk ? `Send ${amount} points to ${friend.firstName}` : "Send points"}
          </button>
          <p className="text-center text-xs text-slate-400">Sent points can&apos;t be taken back.</p>
        </form>
      )}
      {!pointsOk && error && <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p>}
    </section>
  );
}
