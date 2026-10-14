"use client";

import { mediaUrl, useContent } from "@/lib/content";

// "Corporate Network. We Trusted": the logos of the organisations the venue works with, moving slowly from left to right
// in a loop. Staff manage the list in the admin portal (Corporate Network). It pauses while a finger or the mouse is on it,
// and stands still when the device asks for reduced motion (the logos can then be scrolled sideways by hand).
export default function PartnersStrip() {
  const partners = useContent().partners;
  if (partners.length === 0) return null;

  // enough logos in one half that the strip never shows a gap, then the half is repeated for a seamless loop
  const half = Array.from({ length: Math.max(1, Math.ceil(8 / partners.length)) }, () => partners).flat();
  const seconds = Math.max(24, half.length * 4);
  const track = [...half, ...half];

  return (
    <section aria-label="Corporate Network" className="mb-10">
      <h2 className="text-center text-lg font-bold text-brand desk:text-2xl">Corporate Network. We Trusted</h2>
      <div className="uf-partners mt-4 overflow-hidden desk:mt-6" style={{ ["--uf-partners-seconds" as string]: `${seconds}s` }}>
        <ul className="uf-partners-track flex w-max items-stretch gap-3 py-2 desk:gap-5">
          {track.map((p, i) => (
            <li key={`${p.id}-${i}`} aria-hidden={i >= half.length ? true : undefined} className="flex w-36 shrink-0 flex-col items-center gap-2 desk:w-48">
              <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)] desk:h-28 desk:p-4">
                {/* logos are served by the API, so next/image is not used */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(p.imageUrl)} alt={i < half.length ? p.name : ""} loading="lazy" draggable={false} className="h-full w-full object-contain" />
              </div>
              <span className="w-full truncate text-center text-xs font-medium text-slate-600 desk:text-sm">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
