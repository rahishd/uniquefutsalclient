"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { mediaUrl } from "@/lib/content";
import { partnersStore } from "@/lib/marketplace";

// The partners' banners, one slide each, the same look as the offers banner on Home: swipe left or right, or wait and it moves on by itself.
// A tap opens the Partner Marketplace. Nothing shows while no partnership is live or no partner has a banner.
// Picture size the partner makes: 1280 x 560 px (16:7).
const PAUSE_AFTER_TOUCH_MS = 8000;

export default function PartnerBanners() {
  const partners = (partnersStore.use().data ?? []).filter((p) => p.bannerUrl);
  const track = useRef<HTMLDivElement>(null);
  const hold = useRef(0);
  const [pos, setPos] = useState(0);
  const [retry, setRetry] = useState(0);
  const count = partners.length;
  const at = count ? Math.min(pos, count - 1) : 0;

  const go = useCallback((i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (count < 2) return;
    // each banner stays for its own number of seconds (set by the staff, 3 to 60)
    const seconds = Math.min(60, Math.max(3, partners[at]?.bannerSeconds ?? 6));
    const t = setTimeout(() => { if (Date.now() < hold.current) setRetry((n) => n + 1); else go((at + 1) % count); }, seconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, at, go, retry]);

  if (count === 0) return null;
  const p = partners[at];
  return (
    <section aria-label="Our partners" className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-black/5">
      <div ref={track} onScroll={(e) => { const el = e.currentTarget; setPos(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        onTouchStart={() => { hold.current = Date.now() + PAUSE_AFTER_TOUCH_MS; }} onPointerDown={() => { hold.current = Date.now() + PAUSE_AFTER_TOUCH_MS; }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {partners.map((x) => (
          <Link key={x.id} href="/marketplace" aria-label={`${x.name}: see the offers`} className="relative block aspect-[16/7] w-full shrink-0 snap-center overflow-hidden">
            {/* partner pictures come from the venue's own API, so next/image is not used */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(x.bannerUrl as string)} alt={x.name} draggable={false} className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="min-w-0 truncate text-sm font-semibold text-[#0c0b5d]">{p.name} <span className="font-normal text-slate-500">· {p.offers[0]?.discountText}</span></p>
        {count > 1 && (
          <div className="flex shrink-0 gap-1.5" role="tablist" aria-label="Choose a partner">
            {partners.map((x, i) => <button key={x.id} type="button" role="tab" aria-selected={i === at} aria-label={`Show ${x.name}`} onClick={() => go(i)} className={`h-2 rounded-full transition-all ${i === at ? "w-5 bg-[#0c0b5d]" : "w-2 bg-slate-300"}`} />)}
          </div>
        )}
      </div>
    </section>
  );
}
