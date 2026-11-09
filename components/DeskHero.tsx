"use client";

import { useLayoutEffect, useRef, useState } from "react";

// The venue banner on Home. The cards drawn on the picture are part of the picture: they are not links.
//   DeskHero  - desktop only: public/home-hero.webp (2560 x 1120) as the hero, edge to edge under the top bar. It breaks out of the page
//               column and its top padding, and is measured against the visible window (without the scroll bar) so it never adds a sideways scroll.
//   MobileHero - the phone: no picture, only the headline "Book your game today" in black, shown inside the account card (signed in) or
//               under the logo (a guest), see components/HomeTop.tsx.
// the four highlights that the desktop banner shows as cards on its picture (they are not links)
const HIGHLIGHTS = [
  { top: "Health", main: "Insurance", bg: "bg-[#1473c4]" },
  { top: "300+", main: "Sitting", bg: "bg-[#79b32c]" },
  { top: "Parafit", main: "Gamezone", bg: "bg-[#ef5350]" },
  { top: "Dedicated Membership", main: "Plans", bg: "bg-[#25b5a1]" },
];

export function MobileHero() {
  // on the phone the banner picture is not used: the headline in black, then the four highlights as colourful cards
  return (
    <div className="px-5 pb-1 pt-3">
      <h2 className="text-center text-[1.4rem] font-extrabold uppercase leading-tight tracking-wide text-black whitespace-nowrap">Book your game today</h2>
      <ul className="mt-3 grid grid-cols-4 gap-1.5">
        {HIGHLIGHTS.map((h) => (
          <li key={h.main} className={`${h.bg} flex min-w-0 flex-col items-center justify-center rounded-md px-0.5 py-2 text-center text-white shadow-sm`}>
            <span className="text-[6.5px] font-medium uppercase leading-tight tracking-[0.12em] opacity-90">{h.top}</span>
            <span className="text-[10.5px] font-extrabold uppercase leading-tight">{h.main}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DeskHero() {
  const box = useRef<HTMLElement>(null);
  const [fit, setFit] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = box.current;
      if (!el) return;
      const was = el.style.marginLeft;
      el.style.marginLeft = "0px";
      const left = el.getBoundingClientRect().left; // where the page column puts it, from the window's left edge
      el.style.marginLeft = was;
      setFit({ left: -left, width: document.documentElement.clientWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section
      ref={box}
      aria-label="Unique Futsal"
      className="uf-plain relative order-1 hidden overflow-hidden desk:col-span-12 desk:-mt-8 desk:mb-2 desk:block desk:max-w-none"
      style={fit ? { marginLeft: fit.left, width: fit.width } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home-hero.webp" alt="Unique Futsal: book your game today. Health insurance, 300+ sitting, Parafit Gamezone and dedicated membership plans." width={2560} height={1120} className="block h-auto w-full" />
    </section>
  );
}
