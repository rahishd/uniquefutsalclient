"use client";

import { mediaUrl, useContent, type Partner } from "@/lib/content";

// One moving row of logos. The row holds the logos twice, so moving it by half a width loops without a jump.
// `reverse` runs it the other way (right to left). Each logo also floats gently up and down, a little out of step.
function Row({ partners, reverse, label }: { partners: Partner[]; reverse?: boolean; label: string }) {
  // enough logos in one half that the row never shows a gap
  const half = Array.from({ length: Math.max(1, Math.ceil(8 / partners.length)) }, () => partners).flat();
  const seconds = Math.max(24, half.length * 4);
  const track = [...half, ...half];
  return (
    <div className="uf-partners overflow-hidden" style={{ ["--uf-partners-seconds" as string]: `${seconds}s` }} aria-label={label}>
      <ul className={`uf-partners-track flex w-max items-stretch gap-3 py-3 desk:gap-5 ${reverse ? "uf-partners-reverse" : ""}`}>
        {track.map((p, i) => (
          <li key={`${p.id}-${i}`} aria-hidden={i >= half.length ? true : undefined} className="flex w-36 shrink-0 flex-col items-center gap-2 desk:w-48">
            <div className="uf-float flex h-20 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.18)] desk:h-28 desk:p-4" style={{ animationDelay: `${(i % 5) * -0.7}s` }}>
              {/* logos are served by the API, so next/image is not used */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p.imageUrl)} alt={i < half.length ? p.name : ""} loading="lazy" draggable={false} className="h-full w-full object-contain" />
            </div>
            <span className="w-full truncate text-center text-xs font-medium text-slate-600 desk:text-sm">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "Corporate Network. We Trusted": the logos of the organisations the venue works with, in two rows that move in opposite
// directions (top row left to right, bottom row right to left). Staff manage the list in the admin portal (Corporate Network).
// A row pauses while a finger or the mouse is on it, and stands still when the device asks for reduced motion (the logos can
// then be scrolled sideways by hand).
export default function PartnersStrip() {
  const partners = useContent().partners;
  if (partners.length === 0) return null;

  // split the logos between the two rows; with only a few, both rows show all of them (the second starts further along)
  const top = partners.length >= 4 ? partners.filter((_, i) => i % 2 === 0) : partners;
  const bottom = partners.length >= 4 ? partners.filter((_, i) => i % 2 === 1) : [...partners.slice(Math.ceil(partners.length / 2)), ...partners.slice(0, Math.ceil(partners.length / 2))];

  return (
    <section aria-label="Corporate Network" className="mb-10">
      <h2 className="text-left text-lg font-bold text-brand desk:text-2xl">Corporate Network. We Trusted</h2>
      <div className="mt-3 space-y-1 desk:mt-5">
        <Row partners={top} label="Partners, first row" />
        <Row partners={bottom} reverse label="Partners, second row" />
      </div>
    </section>
  );
}
