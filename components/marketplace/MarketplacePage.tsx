"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Gift, Loader2, Star, Store, UserRound } from "lucide-react";
import PartnerBanners from "./PartnerBanners";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { loyaltyStore } from "@/lib/loyalty";
import { cardsStore, day, partnersStore, redeemOffer, type MarketPartner, type PartnerCard, type PartnerOffer } from "@/lib/marketplace";
import { fmtPts } from "@/lib/points";
import { openSignIn, useSession } from "@/lib/session";

// Partner Marketplace: the businesses that give Unique Futsal customers a discount for loyalty points. Redeem points for a card, show its code at the
// partner. "My loyalty card" is the proof of the points earned on our bills.
const STATUS = { active: { label: "Ready to use", tone: "bg-emerald-100 text-emerald-700" }, used: { label: "Used", tone: "bg-slate-200 text-slate-600" }, cancelled: { label: "Cancelled", tone: "bg-rose-100 text-rose-700" }, expired: { label: "Expired - Unused", tone: "bg-amber-100 text-amber-700" } } as const;

// My cards are grouped: still to use (upcoming), already used, and expired (a cancelled card sits here too)
const CARD_TABS = [{ id: "upcoming", label: "Upcoming" }, { id: "used", label: "Used" }, { id: "expired", label: "Expired" }] as const;
const cardGroup = (c: PartnerCard) => (c.status === "active" ? "upcoming" : c.status === "used" ? "used" : "expired");

function CardTicket({ c }: { c: PartnerCard }) {
  const live = c.status === "active";
  return (
    <li className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${live ? "border-emerald-200" : "border-slate-200 opacity-80"}`}>
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#0c0b5d] to-[#2a2aa8] p-4 text-white">
        <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-white/60">{c.category}</p><p className="truncate text-lg font-semibold">{c.partner}</p><p className="text-sm text-white/80">{c.discountText}</p></div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-300 p-4">
        <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-slate-500">Show this code</p><p className={`font-mono text-2xl font-bold tracking-widest ${c.status === "expired" ? "text-slate-400 line-through" : "text-[#0c0b5d]"}`}>{c.cardCode}</p></div>
        <div className="shrink-0 text-right text-xs text-slate-500"><p className="font-semibold text-slate-700">{fmtPts(c.points)} points</p><p>{day(c.createdAt)}</p><p>{c.status === "expired" ? "expired" : "valid until"} {day(c.validUntil)}</p></div>
      </div>
    </li>
  );
}

// The big number of an offer, read from what staff wrote: "10% on all bags" gives 10%, "Rs. 200 off" gives Rs. 200. Nothing found: a gift icon.
function discountBadge(text: string): { big: string; small: string } | null {
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return { big: `${pct[1]}%`, small: "OFF" };
  const rs = text.match(/(?:rs\.?|npr|रु\.?)\s*([\d,]+(?:\.\d+)?)/i) ?? text.match(/([\d,]+)\s*(?:rs|npr|rupees)\b/i);
  if (rs) return { big: `Rs. ${rs[1]}`, small: "OFF" };
  return null;
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
        {(() => { const b = discountBadge(o.discountText); return (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-1 text-center text-white shadow-sm" aria-hidden>
            {b ? <span className="leading-none"><span className={`block font-extrabold ${b.big.length > 4 ? "text-sm" : "text-xl"}`}>{b.big}</span><span className="mt-0.5 block text-[10px] font-bold tracking-wide text-emerald-100">{b.small}</span></span> : <Gift size={24} />}
          </span>
        ); })()}
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
  const [view, setView] = useState<"offers" | "cards">("offers");
  const [cardTab, setCardTab] = useState<"upcoming" | "used" | "expired">("upcoming");
  const signedIn = session?.registered === true;
  const list = partners.data ?? [];
  const points = loy?.remaining ?? 0;

  return (
    <div className="space-y-4 pb-4">
      {/* the top block stays on screen while the offers or cards below scroll */}
      <div className="sticky top-0 z-20 -mx-5 -mt-[calc(env(safe-area-inset-top)+1.25rem)] space-y-2 bg-white px-5 pb-2 pt-[calc(env(safe-area-inset-top)+1.5rem)] desk:mt-0 desk:pt-1 desk:static desk:mx-0 desk:bg-transparent desk:px-0">
      <div className="flex items-center gap-2">
        <Link href="/points" aria-label="Back to loyalty points" className="grid h-8 w-8 place-items-center rounded-full bg-white/70 text-[#0c0b5d] shadow-sm"><ChevronLeft size={20} /></Link>
        <h1 className="min-w-0 flex-1 text-xl font-semibold">Partner offers</h1>
        {signedIn && (
          <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-sky-100 px-3 py-1.5 ring-1 ring-sky-200" aria-label={`Points now: ${fmtPts(points)}`}>
            <Star size={22} className="shrink-0 fill-amber-400 text-amber-400" />
            <span className="flex flex-col leading-tight"><span className="text-[10px] font-semibold text-sky-800">Points now</span><span className="text-xl font-extrabold tabular-nums leading-none text-[#0c0b5d]">{fmtPts(points)}</span></span>
          </div>
        )}
      </div>
      <p className="text-xs leading-snug text-slate-500">Our partners give you a discount when you use your loyalty points. Pick an offer, get your card, show the code.</p>

      <PartnerBanners />

        {signedIn && (
          <div role="tablist" aria-label="Partner offers" className="grid grid-cols-2 gap-1 rounded-2xl bg-white/60 p-1">
            {([["offers", "Offers"], ["cards", `My cards (${cards.length})`]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${view === id ? "bg-[#0c0b5d] text-white shadow" : "text-slate-600"}`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {!signedIn && (
        <div className="glass flex items-center gap-3 rounded-3xl p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><UserRound size={20} /></span><p className="min-w-0 flex-1 text-sm text-slate-600">Sign in to use your loyalty points at our partners.</p><button type="button" onClick={openSignIn} className="glass-btn shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold text-white">Sign in</button></div>
      )}

      {fresh && (
        <div role="status" className="space-y-2 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 font-semibold text-emerald-800"><Check size={18} /> Your card is ready</p>
          <ul><CardTicket c={fresh} /></ul>
          <p className="text-xs text-emerald-800">Show the code {fresh.cardCode} at {fresh.partner}. It is also saved under My cards below.</p>
        </div>
      )}

      {(!signedIn || view === "offers") && <>
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

      </>}

      {signedIn && view === "cards" && (
        <section aria-label="My cards" className="space-y-3">
          {cards.length === 0 ? <p className="rounded-3xl bg-white/60 p-5 text-center text-sm text-slate-500">You have not used a partner offer yet.</p> : (
            <>
              <p className="rounded-2xl bg-white/60 p-3 text-xs leading-relaxed text-slate-600">Each card is a discount you got with your loyalty points. Show its code at the partner to get the offer. A card is valid for <b>7 days</b> from the day you claim it. After that it expires unused and the points are not returned.</p>
              <div role="tablist" aria-label="My cards" className="grid grid-cols-3 gap-1 rounded-2xl bg-white/60 p-1">
                {CARD_TABS.map((t) => {
                  const n = cards.filter((c) => cardGroup(c) === t.id).length;
                  return <button key={t.id} type="button" role="tab" aria-selected={cardTab === t.id} onClick={() => setCardTab(t.id)} className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${cardTab === t.id ? "bg-[#0c0b5d] text-white shadow" : "text-slate-600"}`}>{t.label} ({n})</button>;
                })}
              </div>
              {(() => {
                const shown = cards.filter((c) => cardGroup(c) === cardTab);
                return shown.length === 0
                  ? <p className="rounded-3xl bg-white/60 p-5 text-center text-sm text-slate-500">{cardTab === "upcoming" ? "No card waiting to be used." : cardTab === "used" ? "No used cards yet." : "No expired cards."}</p>
                  : <ul className="space-y-3">{shown.map((c) => <CardTicket key={c.id} c={c} />)}</ul>;
              })()}
            </>
          )}
        </section>
      )}
    </div>
  );
}
