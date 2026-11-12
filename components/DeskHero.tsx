"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Armchair, CalendarDays, Crown, Gamepad2, MapPin, ShieldCheck } from "lucide-react";
import QuickRebook from "@/components/QuickRebook";
import { weatherIcon, weatherWord } from "@/components/TodayCard";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { PLACE, useNepaliToday, useWeather } from "@/lib/today";

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

// Desktop: the bar on top of the hero picture. The temperature on the left, the search bar in the centre, the Nepali date and place on the right.
function HeroBar() {
  const today = useNepaliToday();
  const weather = useWeather();
  const session = useSession();
  const t = useT();
  const code = weather ? weather.code : 2;
  const name = session?.registered ? session.name : "Guest";
  const shadow = "drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]";
  return (
    <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 via-black/20 to-transparent pb-10 pt-[calc(var(--uf-hdr-h,0px)+1.25rem)] text-white">
      {/* the same column as the top bar (max 1320px, 40px sides), so the greeting starts exactly under the logo and the weather ends exactly under the Profile button */}
      <div className="mx-auto flex w-full max-w-[1320px] items-start justify-between gap-6 px-10">
      {/* the name on the left and the weather and date on the right share one row, each centred in a 52px-tall box */}
      {/* top left: who is here */}
      <div className={`flex h-[52px] min-w-0 flex-col justify-center justify-self-start ${shadow}`}>
        <p className="text-xs font-semibold text-sky-100">{t("Hello")} <span aria-hidden>👋</span></p>
        <p className="max-w-[15rem] truncate text-xl font-bold leading-tight">{session ? name : ""}</p>
      </div>
      {/* right: the temperature and the Nepali date, with a thin line between them */}
      <div className={`flex h-[52px] items-center gap-3 justify-self-end ${shadow}`}>
        <div className="flex items-center gap-2">
          <span className="text-sky-200">{weatherIcon(code, 22)}</span>
          <div>
            <p className="flex items-baseline gap-0.5 text-[21px] font-bold leading-none tracking-tight">{weather ? weather.temp : "--"}<span className="text-[11px] font-semibold text-sky-200">°C</span></p>
            <p className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-sky-100">{t(weatherWord(code))}</p>
          </div>
        </div>
        <span aria-hidden className="h-8 w-px bg-white/40" />
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-1.5 whitespace-nowrap text-xs font-bold"><CalendarDays size={13} className="shrink-0 text-sky-200" aria-hidden /><span>{today.en || " "}</span></p>
          <p className="mt-0.5 flex items-center justify-end gap-1.5 whitespace-nowrap text-[11px] font-semibold text-sky-100"><MapPin size={12} className="shrink-0" aria-hidden /><span>{weather?.place ?? PLACE}</span></p>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function DeskHero({ children }: { children?: React.ReactNode }) {
  const box = useRef<HTMLElement>(null);
  const [fit, setFit] = useState<{ left: number; width: number; head: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = box.current;
      if (!el) return;
      const was = el.style.marginLeft;
      el.style.marginLeft = "0px";
      const left = el.getBoundingClientRect().left; // where the page column puts it, from the window's left edge
      el.style.marginLeft = was;
      // the top bar is part of the picture: the hero starts at the very top of the page, behind the bar
      const head = document.querySelector<HTMLElement>(".uf-navy-header")?.getBoundingClientRect().height ?? 0;
      setFit({ left: -left, width: document.documentElement.clientWidth, head });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section
      ref={box}
      aria-label="Unique Futsal"
      className="uf-plain relative order-1 hidden desk:z-20 desk:col-span-12 desk:mb-2 desk:block desk:max-w-none"
      style={fit ? ({ marginLeft: fit.left, width: fit.width, marginTop: -(32 + fit.head), "--uf-hdr-h": fit.head + "px" } as React.CSSProperties) : undefined}
    >
      {/* the picture (public/home-hero-top.webp, 2000 x 875): it begins at the very top of the page, so the top bar sits on it (components/CompanyHeader.tsx).
          It is shown whole, as wide as the window. The heading "Your next match. Starts here." is part of the picture. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home-hero-top.webp?v=8" alt="Unique Futsal: your next match starts here." width={2000} height={875} className="block w-full object-cover" style={{ aspectRatio: "2000 / 875" }} />
      <HeroBar />
      {/* The two blocks at the bottom of the picture stand on the same line as the bottom of the slogan drawn on it ("Starts here." ends at pixel 799 of the picture's 875, so 8.7% above
          the bottom edge). Their bottom edges are level with it. */}
      {/* "Book again" for a returning customer (nothing shows for a guest or a new customer): at the bottom centre */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[8.7%] z-20 flex items-end justify-center">
        <div className="pointer-events-auto flex empty:hidden [&>section]:mt-0"><QuickRebook variant="hero" /></div>
      </div>
      {/* whatever is passed in (the typing lines) sits at the bottom right, 2.75% from the right edge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[8.7%] z-20 flex items-end justify-end pr-[2.75%] text-right">{children}</div>
    </section>
  );
}
