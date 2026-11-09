"use client";

import { useLayoutEffect, useRef, useState } from "react";

// The venue banner on Home. The cards drawn on the picture are part of the picture: they are not links.
//   DeskHero  - desktop only: public/home-hero.webp (2560 x 1120) as the hero, edge to edge under the top bar. It breaks out of the page
//               column and its top padding, and is measured against the visible window (without the scroll bar) so it never adds a sideways scroll.
//   MobileHero - the phone: a taller picture made for a narrow screen (public/home-hero-mobile.webp, 1200 x 960), shown inside the account card
//               (signed in) or edge to edge under the logo (a guest), see components/HomeTop.tsx.
export function MobileHero() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/home-hero-mobile.webp" alt="Unique Futsal: book your game today. Health insurance, 300+ sitting, Parafit Gamezone and dedicated membership plans." width={1200} height={960} className="block h-auto w-full" />
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
