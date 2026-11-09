"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

// Desktop Home only: the venue banner (public/home-hero.webp, 2560 x 1120) as the hero, edge to edge under the top bar. It breaks out of the
// page column and its top padding, and is measured against the visible window (without the scroll bar) so it never adds a sideways scroll.
// The four cards drawn on the picture are links; their boxes match where the cards sit on the picture (in % of its width and height).
// On the phone the same picture sits inside the account card (components/HomeTop.tsx).
const CARDS = [
  { label: "Futsal court: book a game", href: "/book", left: 19.22 },
  { label: "PlayStation Gamezone", href: "/gamezone", left: 34.69 },
  { label: "Hosted tournaments", href: "/tournaments", left: 50.16 },
  { label: "Membership plans", href: "/member", left: 65.63 },
];

// the desktop picture with its four card links
function HeroBanner() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home-hero.webp" alt="Unique Futsal: book your game today. Futsal court, PlayStation Gamezone, hosted tournaments and membership plans." width={2560} height={1120} className="block h-auto w-full" />
      {CARDS.map((c) => (
        <Link key={c.href} href={c.href} aria-label={c.label} className="absolute transition hover:bg-[rgba(255,255,255,0.12)]" style={{ left: `${c.left}%`, top: "87.14%", width: "14.84%", height: "9.29%" }} />
      ))}
    </>
  );
}

// The phone version: a taller picture made for a narrow screen (public/home-hero-mobile.webp, 1200 x 960) with a bigger heading and the
// four cards in two rows. It is shown inside the account card and runs edge to edge across it.
const M_CARDS = [
  { label: "Futsal court: book a game", href: "/book", left: 3, top: 70.83 },
  { label: "PlayStation Gamezone", href: "/gamezone", left: 51.5, top: 70.83 },
  { label: "Hosted tournaments", href: "/tournaments", left: 3, top: 85 },
  { label: "Membership plans", href: "/member", left: 51.5, top: 85 },
];

export function MobileHero() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home-hero-mobile.webp" alt="Unique Futsal: book your game today. Futsal court, PlayStation Gamezone, hosted tournaments and membership plans." width={1200} height={960} className="block h-auto w-full" />
      {M_CARDS.map((c) => (
        <Link key={c.href} href={c.href} aria-label={c.label} className="absolute transition active:bg-[rgba(255,255,255,0.15)]" style={{ left: `${c.left}%`, top: `${c.top}%`, width: "45.5%", height: "12.08%" }} />
      ))}
    </>
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
      <HeroBanner />
    </section>
  );
}
