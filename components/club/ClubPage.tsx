"use client";

import CharityLine from "@/components/CharityLine";
import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Check, Crown, Gamepad2, Loader2, Tag, Trophy } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { FALLBACK, clubStore, joinClub, type ClubOrder } from "@/lib/club";
import { formatRs } from "@/lib/booking";
import PaymentQr from "@/components/payment/PaymentQr";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

// Unique Club: Rs. 1,500 for 30 days; 10% off bookings, Gamezone and hosted tournaments, applied for you at checkout.
export default function ClubPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const { data } = clubStore.use();
  const club = data ?? FALLBACK;
  const [order, setOrder] = useState<ClubOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      setOrder(await joinClub());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pb-32 pt-8 desk:max-w-2xl desk:pb-16">
        <PaymentQr
          method={order.method}
          orderId={order.orderCode}
          amount={order.amount}
          remarks={order.remarks}
          payload={order.qrPayload}
          expiresAt={order.expiresAt}
          backLabel="Back to Unique Club"
          onBack={() => setOrder(null)}
          onPaid={() => {
            setOrder(null);
            setWelcome(true);
            clubStore.refresh();
          }}
        />
      </main>
    );
  }

  const pct = club.member ? Math.min(100, Math.round((club.daysLeft / club.days) * 100)) : 0;

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 pb-32 pt-8 desk:max-w-2xl desk:pb-16">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><BadgeCheck size={26} className="text-brand" /> Unique Club</h1>
        <p className="mt-1 text-sm text-slate-500">Join the club and get {club.percent}% off every game, every time.</p>
      </header>

      <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] to-[#2a2aa8] p-6">
        <p className="text-sm font-medium">Monthly club fee</p>
        <p className="mt-1 text-4xl font-bold">{formatRs(club.fee)}</p>
        <p className="mt-1 text-sm">for {club.days} days · {club.percent}% off bookings</p>
        <div className="mt-2"><CharityLine amount={club.fee} as="note" align="left" /></div>
      </section>

      {welcome && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          <Check size={16} /> Welcome to Unique Club! Your {club.percent}% discount is on.
        </p>
      )}

      {club.member && (
        <section className="glass rounded-3xl p-5" aria-label="Your membership">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><BadgeCheck size={16} /> You are a Unique Club member</p>
          <p className="mt-1 text-sm text-slate-600">Valid until <span className="font-semibold">{day(club.validUntil!)}</span> · {club.daysLeft} day{club.daysLeft === 1 ? "" : "s"} left</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#0c0b5d]" style={{ width: `${pct}%` }} />
          </div>
        </section>
      )}
      {club.member && !club.mature && (
        <section className="glass rounded-3xl p-5" aria-label="Unlock membership and hosting discounts">
          <p className="text-sm font-semibold">Unlock the membership and tournament discounts</p>
          <p className="mt-1 text-xs text-slate-500">Court bookings and Gamezone are {club.percent}% off from today. The 1-month membership plan and hosting a tournament need {club.matureAfterDays} days in the club <b>or</b> {club.matureAfterGames} games played since you joined.</p>
          <p className="mt-3 text-sm">Day <b>{Math.min(club.daysIn, club.matureAfterDays)}</b> of {club.matureAfterDays} · <b>{Math.min(club.gamesPlayed, club.matureAfterGames)}</b> of {club.matureAfterGames} games</p>
        </section>
      )}
      {club.member && club.mature && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"><Check size={16} /> Membership and tournament-hosting discounts are unlocked.</p>
      )}
      {club.expired && !club.member && (
        <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-800">Your club ended on {day(club.validUntil!)}. Renew to get {club.percent}% off again.</p>
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold">What you get</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-start gap-3"><CalendarDays size={18} className="mt-0.5 shrink-0 text-brand" /><span><b>{club.percent}% off court bookings</b><br /><span className="text-slate-500">Taken off automatically when you book.</span></span></li>
          <li className="flex items-start gap-3"><Gamepad2 size={18} className="mt-0.5 shrink-0 text-brand" /><span><b>{club.percent}% off Gamezone</b><br /><span className="text-slate-500">PS5 sessions are cheaper for members.</span></span></li>
          <li className="flex items-start gap-3"><Trophy size={18} className="mt-0.5 shrink-0 text-brand" /><span><b>{club.percent}% off hosting a tournament</b><br /><span className="text-slate-500">On the court charge of tournaments you host at the venue, after {club.matureAfterDays} days in the club or {club.matureAfterGames} games played.</span></span></li>
          <li className="flex items-start gap-3"><Crown size={18} className="mt-0.5 shrink-0 text-brand" /><span><b>{club.percent}% off the 1-month membership</b><br /><span className="text-slate-500">Only the 1-month plan, after {club.matureAfterDays} days in the club or {club.matureAfterGames} games played. Longer plans keep their own price.</span></span></li>
          <li className="flex items-start gap-3"><Tag size={18} className="mt-0.5 shrink-0 text-brand" /><span><b>Sure shot discount</b><br /><span className="text-slate-500">It replaces promo codes: members cannot add a promo code on top, and the venue sees your club discount on your bill and receipt.</span></span></li>
        </ul>
      </section>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to join Unique Club</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : (
        <div className="space-y-3">
          <button type="button" disabled={busy} onClick={pay} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
            {club.member ? `Renew for ${club.days} more days · ${formatRs(club.fee)}` : `Join Unique Club · ${formatRs(club.fee)}`}
          </button>
          <p className="text-center text-xs text-slate-400">Pay once with the Fonepay QR. The club switches on as soon as the payment arrives.</p>
          {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      <p className="text-center text-xs text-slate-400"><Link href="/help" className="font-semibold text-brand">How does it work?</Link></p>
    </main>
  );
}
