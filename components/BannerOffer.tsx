"use client";

import { Tag } from "lucide-react";
import { promosStore } from "@/lib/promos";

// The badge on the Home promo banner. It is worked out from today's live booking promo codes (the same list as
// "Live promo codes"), so it can never promise more than a customer can actually get. With no live code it shows nothing.
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

  // Colours are inline: the banner's own text rules would otherwise turn the badge text navy on navy.
  return (
    <span className="mb-3 flex flex-col items-start gap-1 desk:mb-4" style={{ color: "#0c0b5d" }}>
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase leading-none tracking-[0.18em] desk:text-xs" style={{ color: "#0c0b5d" }}>
        <Tag size={11} strokeWidth={2.6} aria-hidden />
        Today
      </span>
      <span className="text-2xl font-extrabold leading-none desk:text-4xl" style={{ color: "#0c0b5d" }}>
        Up to {value} <span className="text-base font-bold desk:text-xl">OFF</span>
      </span>
    </span>
  );
}
