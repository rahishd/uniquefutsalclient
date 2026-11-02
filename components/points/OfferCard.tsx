"use client";

import { useState } from "react";
import { Check, Gift, Loader2, Star } from "lucide-react";
import { errorText } from "@/lib/api";
import { claimOffer, loyaltyStore, type PointsOffer } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";

// Points the venue offers as a gift: a card with the amount and the reason, and a button to take them.
// Shown on top of the Points page and, until taken, just below the search bar on Home.
export function OfferCard({ offer, className = "" }: { offer: PointsOffer; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    setBusy(true); setError(null);
    try { await claimOffer(offer.id); } catch (e) { setError(errorText(e)); setBusy(false); }
  }
  return (
    <section aria-label="A gift of loyalty points" className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-400 p-5 text-white shadow-[0_18px_34px_-18px_rgba(244,63,94,0.85)] ${className}`}>
      <Gift size={120} className="pointer-events-none absolute -right-5 -top-5 rotate-12 text-white/15" aria-hidden />
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white"><Gift size={14} aria-hidden /> A gift from Unique Futsal</p>
      <p className="mt-2 flex items-end gap-2 leading-none"><Star className="fill-white text-white" size={30} aria-hidden /><span className="text-5xl font-extrabold">+{fmtPts(offer.points)}</span><span className="pb-1 text-base font-bold">loyalty points</span></p>
      <p className="mt-3 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-semibold !text-black">{offer.reason}</p>
      {error && <p role="alert" className="mt-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold !text-rose-700">{error}</p>}
      <button type="button" onClick={add} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-base font-bold !text-rose-600 shadow-md transition active:scale-[0.98] disabled:opacity-60">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Add to my points
      </button>
    </section>
  );
}

/** Every gift waiting for this customer; renders nothing for guests or when there is none. */
export default function GiftOffers({ className = "" }: { className?: string }) {
  const offers = loyaltyStore.use().data?.offers ?? [];
  if (offers.length === 0) return null;
  return <div className={`space-y-3 ${className}`}>{offers.map((o) => <OfferCard key={o.id} offer={o} />)}</div>;
}
