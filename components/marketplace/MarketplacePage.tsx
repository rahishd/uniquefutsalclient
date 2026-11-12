"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Loader2, Star, Store, Ticket, UserRound } from "lucide-react";
import LoyaltyCardView from "./LoyaltyCardView";
import PartnerBanners from "./PartnerBanners";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { loyaltyStore } from "@/lib/loyalty";
import { cardsStore, day, partnersStore, redeemOffer, type MarketPartner, type PartnerCard, type PartnerOffer } from "@/lib/marketplace";
import { fmtPts } from "@/lib/points";
import { openSignIn, useSession } from "@/lib/session";

// Partner Marketplace: the businesses that give Unique Futsal customers a discount for loyalty points. Redeem points for a card, show its code at the
// partner. "My loyalty card" is the proof of the points earned on our bills.
const STATUS = { active: { label: "Ready to use", tone: "bg-emerald-100 text-emerald-700" }, used: { label: "Used", tone: "bg-slate-200 text-slate-600" }, cancelled: { label: "Cancelled", tone: "bg-rose-100 text-rose-700" } } as const;

function CardTicket({ c }: { c: PartnerCard }) {
  const live = c.status === "active";
  return (
    <li className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${live ? "border-emerald-200" : "border-slate-200 opacity-80"}`}>
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#0c0b5d] to-[#2a2aa8] p-4 text-white">
        <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-white/60">{c.category}</p><p className="truncate text-lg font-semibold">{c.partner}</p><p className="text-sm text-white/80">{c.discountText}</p></div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-300 p-4">
        <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-slate-500">Show this code</p><p className="font-mono text-2xl font-bold tracking-widest text-[#0c0b5d]">{c.cardCode}</p></div>
        <div className="shrink-0 text-right text-xs text-slate-500"><p className="font-semibold text-slate-700">{fmtPts(c.points)} points</p><p>{day(c.createdAt)}</p><p>valid until {day(c.validUntil)}</p></div>
      </div>
    </li>
  );
}

function OfferRow({ partner, o, points, signedIn, onDone }: { partner: MarketPartner; o: PartnerOffer; points: number; signedIn: boolean; onDone: (c: PartnerCard) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const enough = points >= o.pointsCost;
  async function redeem() {
    if (!signedIn) return openSignIn();
    if (!(await askConfirm(`Use ${fmtPts(o.pointsCost)} loyalty points for "${o.discountText}" at ${partner.name}?`, { confirmLabel: "Use points" }))) return;
    setBusy(true); setErr("");
    try { onDone(await redeemOffer(o.id)); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="font-semibold text-[#14142b]">{o.discountText}</p><p className="text-xs text-slate-500">{o.title}{o.maxPerCustomer ? ` · ${o.maxPerCustomer === 1 ? "once" : o.maxPerCustomer + " times"} per customer` : ""}</p></div>
        <button type="button" onClick={redeem} disabled={busy || (signedIn && !enough)} className="glass-btn flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} className="fill-amber-300 text-amber-300" />} {signedIn && !enough ? `Need ${fmtPts(o.pointsCost - points)} more` : `${fmtPts(o.pointsCost)} points`}
        </button>
      </div>
      {err && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{err}</p>}
    </li>
  );
}

export default function MarketplacePage() {
  const session = useSession();
  const partners = partnersStore.use();
  const cards = cardsStore.use().data ?? [];
  const loy = loyaltyStore.use().data;
  const [fresh, setFresh] = useState<PartnerCard | null>(null);
  const signedIn = session?.registered === true;
  const list = partners.data ?? [];
  const points = loy?.remaining ?? 0;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-2">
        <Link href="/points" aria-label="Back to loyalty points" className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-[#0c0b5d] shadow-sm"><ChevronLeft size={20} /></Link>
        <h1 className="text-2xl font-semibold">Partner offers</h1>
      </div>
      <p className="-mt-2 text-sm text-slate-500">Our partners give you a discount when you use your loyalty points. Pick an offer, get your card, show the code.</p>

      <PartnerBanners />

      {signedIn ? <LoyaltyCardView /> : (
        <div className="glass flex items-center gap-3 rounded-3xl p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><UserRound size={20} /></span><p className="min-w-0 flex-1 text-sm text-slate-600">Sign in to use your loyalty points at our partners.</p><button type="button" onClick={openSignIn} className="glass-btn shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold text-white">Sign in</button></div>
      )}

      {fresh && (
        <div role="status" className="space-y-2 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 font-semibold text-emerald-800"><Check size={18} /> Your card is ready</p>
          <ul><CardTicket c={fresh} /></ul>
          <p className="text-xs text-emerald-800">Show the code {fresh.cardCode} at {fresh.partner}. It is also saved under My cards below.</p>
        </div>
      )}

      {partners.status === "loading" && !partners.data && <div className="h-40 animate-pulse rounded-3xl bg-white/40" aria-label="Loading the partners" />}
      {partners.status !== "loading" && list.length === 0 && (
        <div className="glass rounded-3xl p-8 text-center"><Store size={30} className="mx-auto text-slate-400" /><p className="mt-2 font-semibold">No partner offers right now</p><p className="text-sm text-slate-500">New partners are added all the time. Please check again soon.</p></div>
      )}

      <div className="space-y-4">
        {list.map((p) => (
          <section key={p.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5" aria-label={p.name}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-lg font-semibold text-[#0c0b5d]">{p.name}</p><p className="text-xs text-slate-500">{p.category} · offers until {day(p.validUntil)}</p></div></div>
              {p.about && <p className="mt-1 text-sm text-slate-600">{p.about}</p>}
              <ul className="mt-1 divide-y divide-slate-100">
                {p.offers.map((o) => <OfferRow key={o.id} partner={p} o={o} points={points} signedIn={signedIn} onDone={(c) => { setFresh(c); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
              </ul>
            </div>
          </section>
        ))}
      </div>

      {signedIn && (
        <section aria-label="My cards" className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Ticket size={18} className="text-brand" /> My cards</h2>
          {cards.length === 0 ? <p className="rounded-3xl bg-white/60 p-5 text-center text-sm text-slate-500">You have not used a partner offer yet.</p> : <ul className="space-y-3">{cards.map((c) => <CardTicket key={c.id} c={c} />)}</ul>}
        </section>
      )}
    </div>
  );
}
