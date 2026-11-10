"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Armchair, Crown, Gamepad2, ShieldCheck } from "lucide-react";

// The venue banner on Home. The cards drawn on the picture are part of the picture: they are not links.
//   DeskHero  - desktop only: public/home-hero.webp (2560 x 1120) as the hero, edge to edge under the top bar. It breaks out of the page
//               column and its top padding, and is measured against the visible window (without the scroll bar) so it never adds a sideways scroll.
//   MobileHero - the phone: a designed hero (court photo, wordmark, tagline and the four highlights as chips), shown inside the account card (signed in) or
//               under the logo (a guest), see components/HomeTop.tsx.
// the four highlights, as quiet glass chips on the phone hero (not links)
const HIGHLIGHTS = [
  { icon: ShieldCheck, top: "Health", main: "Insurance" },
  { icon: Armchair, top: "300+", main: "Sitting" },
  { icon: Gamepad2, top: "Parafit", main: "Gamezone" },
  { icon: Crown, top: "Dedicated", main: "Membership" },
];

export function MobileHero() {
  // on the phone: the real court photo under a brand-navy wash, the name centred, the four highlights as glass chips along the bottom
  return (
    <section aria-label="Unique Futsal" className="relative isolate overflow-hidden bg-[#0c0b5d] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/court-bg.webp" alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_40%]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[rgba(12,11,93,0.5)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-[linear-gradient(to_top,rgba(12,11,93,0.55),rgba(12,11,93,0))]" />

      <div className="px-5 pb-3 pt-3">
        <h2 className="text-center text-[1.9rem] font-extrabold uppercase leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(12,11,93,0.6)]">Unique Futsal</h2>

        <ul className="mt-5 grid grid-cols-4 gap-1.5">
          {HIGHLIGHTS.map(({ icon: Icon, top, main }) => (
            <li key={main} className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/20 !bg-[rgba(255,255,255,0.12)] px-1 py-2 text-center backdrop-blur-sm">
              <Icon size={16} strokeWidth={1.8} aria-hidden className="text-sky-200" />
              <span className="text-[7px] font-medium uppercase leading-none tracking-[0.12em] text-white/70">{top}</span>
              <span className="text-[9.5px] font-bold uppercase leading-none">{main}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
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
