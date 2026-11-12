"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { mediaUrl, trackAd, useContent, type AdItem } from "@/lib/content";

// The Home banner, right under the search bar: every live "In the Home page" ad as a slide. The customer swipes left or right
// to see the next offer (its name is shown under the picture); with no touch it moves on by itself after each ad's own number of seconds. Nothing shows when no ad is live.
// Picture size to make in the admin portal: 1280 x 560 px (16:7).
const PAUSE_AFTER_TOUCH_MS = 8000;

function Slide({ ad }: { ad: AdItem }) {
  const body = (
    <>
      {/* ads come from the venue's own API, so next/image is not used */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(ad.imageUrl)} alt={ad.title} draggable={false} className="h-full w-full object-cover" />
    </>
  );
  const cls = "relative block aspect-[16/7] w-full shrink-0 snap-center overflow-hidden";
  const click = () => trackAd(ad.id, "click");
  if (!ad.linkUrl) return <div className={cls}>{body}</div>;
  if (ad.linkUrl.startsWith("/")) return <Link href={ad.linkUrl} onClick={click} className={cls}>{body}</Link>;
  return <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={click} className={cls}>{body}</a>;
}

export default function AdCarousel() {
  const ads = useContent().ads.inline;
  const track = useRef<HTMLDivElement>(null);
  const hold = useRef(0); // auto-advance waits until this time (a customer who is swiping is left alone)
  const seen = useRef(new Set<string>());
  const [pos, setPos] = useState(0);
  const [retry, setRetry] = useState(0);
  const count = ads.length;
  const at = count ? Math.min(pos, count - 1) : 0;
  const ad = ads[at];

  const go = useCallback((i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // count a view once per ad, when it is the slide on screen
  useEffect(() => {
    if (ad && !seen.current.has(ad.id)) {
      seen.current.add(ad.id);
      trackAd(ad.id, "view");
    }
  }, [ad]);

  // move on by itself
  useEffect(() => {
    if (count < 2 || !ad) return;
    const t = setTimeout(() => {
      if (Date.now() < hold.current) setRetry((n) => n + 1);
      else go((at + 1) % count);
    }, Math.max(3, ad.displaySeconds) * 1000);
    return () => clearTimeout(t);
  }, [count, ad, at, go, retry]);

  if (!count) return null;
  return (
    <section aria-label="For You">
      <h2 className="mb-2 flex items-center gap-1.5 px-1.5 text-lg font-bold text-[#0c0b5d] desk:text-xl"><Sparkles size={16} strokeWidth={2.2} className="text-brand" aria-hidden />For You</h2>
      <div className="relative overflow-hidden rounded-none bg-white/60">
        <div
          ref={track}
          onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== pos) setPos(i); }}
          onTouchStart={() => { hold.current = Date.now() + PAUSE_AFTER_TOUCH_MS; }}
          onPointerDown={() => { hold.current = Date.now() + PAUSE_AFTER_TOUCH_MS; }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ads.map((a) => <Slide key={a.id} ad={a} />)}
        </div>
      </div>
      {/* the ad's name under the picture, and where you are in the slides */}
      <div className="mt-2 flex items-center justify-between gap-3 px-1.5">
        <p className="min-w-0 truncate text-[13px] font-light tracking-wide text-slate-600">{ad?.title}</p>
        {count > 1 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {ads.map((a, i) => (
              <button key={a.id} type="button" onClick={() => { hold.current = Date.now() + PAUSE_AFTER_TOUCH_MS; go(i); }} aria-label={`Show offer ${i + 1} of ${count}`} aria-current={i === at}
                className={`!h-1.5 !rounded-full transition-all ${i === at ? "!w-5 !bg-[#0c0b5d]" : "!w-1.5 !bg-[#0c0b5d]/25"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
