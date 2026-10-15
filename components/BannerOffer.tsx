"use client";

import { promosStore } from "@/lib/promos";

// The line above the Home banner heading. It is worked out from today's live booking promo codes (the same list as
// "Live promo codes"), so it can never promise more than a customer can actually get. With no live code it says nothing.
export default function BannerOffer() {
  const live = (promosStore.use().data ?? []).filter((p) => p.status === "active" && p.kind === "booking");

  let bestPercent = 0;
  let bestRupees = 0;
  for (const p of live) {
    const pct = /^(\d+(?:\.\d+)?)%/.exec(p.discount);
    if (pct) bestPercent = Math.max(bestPercent, Number(pct[1]));
    const rs = /^Rs\.?\s*([\d,]+)/i.exec(p.discount);
    if (rs) bestRupees = Math.max(bestRupees, Number(rs[1].replace(/,/g, "")));
  }

  const value = bestPercent > 0
    ? `${bestPercent}%`
    : bestRupees > 0
      ? `Rs. ${bestRupees.toLocaleString("en-IN")}`
      : null;

  if (!value) return null;
  return (
    <span className="inline-flex flex-col items-start rounded-xl bg-sky-400 px-3.5 py-2 text-white shadow-[0_8px_18px_-8px_rgba(56,189,248,0.8)] desk:px-5 desk:py-3">
      <span className="text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-white/90 desk:text-xs">Up to</span>
      <span className="mt-1 text-2xl font-extrabold leading-none desk:text-4xl">{value} <span className="text-base font-bold desk:text-xl">OFF</span></span>
    </span>
  );
}
