"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronDown, Eye, EyeOff, Pencil, Star } from "lucide-react";
import { clubStore } from "@/lib/club";
import { profileStore } from "@/lib/profile";
import { loyaltyStore } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";
import { formatHour, isUpcoming, myBookingsStore, parseKey, startsAtMs } from "@/lib/booking";
import { useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { site } from "@/lib/site";
import LastPlayed from "@/components/LastPlayed";
import TodayCard from "@/components/TodayCard";
import LiveMatchStrip from "@/components/LiveMatchStrip";
import { MobileHero } from "@/components/DeskHero";
import GuestPrompt from "@/components/GuestPrompt";
import NotificationBell from "@/components/NotificationBell";
import DigitalIdButton from "@/components/digitalid/DigitalIdButton";
import WifiButton from "@/components/wifi/WifiButton";
import OrderButton from "@/components/order/OrderButton";
import RulesButton from "@/components/rules/RulesButton";

const NONE: never[] = [];
const SHOW_KEY = "uf_show_points";
// "Hi, name!" is typed out over 1 second, then the name blinks in a soft highlight for 3 seconds, and the 4-second round repeats.
// The untyped rest stays in place (invisible), so the line never jumps. With "reduce motion" on it is just shown.
const TYPE_MS = 1000;
const ROUND_MS = 4000;
const WELCOME = "The pitch is waiting for You.";
function TypedGreeting({ first }: { first: string }) {
  const lead = "Hi, ";
  const full = lead + first + ".";
  const [n, setN] = useState(full.length);
  const [blink, setBlink] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [blinkYou, setBlinkYou] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const type = (text: string, ms: number, at: number) => {
      const step = ms / text.length;
      for (let i = 1; i <= text.length; i++) timers.push(setTimeout(() => setN(i), at + step * i));
    };
    // greeting types (1s), name blinks (3s), then "The pitch is waiting for you" types and stays, then back to the greeting
    const round = () => {
      setWelcome(false);
      setN(0);
      setBlink(false);
      setBlinkYou(false);
      type(full, TYPE_MS, 0);
      timers.push(setTimeout(() => setBlink(true), TYPE_MS));
      timers.push(setTimeout(() => { setBlink(false); setWelcome(true); setN(0); }, ROUND_MS));
      type(WELCOME, 1200, ROUND_MS);
      timers.push(setTimeout(() => setBlinkYou(true), ROUND_MS + 1200));
      timers.push(setTimeout(round, ROUND_MS + 1200 + 2000));
    };
    timers.push(setTimeout(round, 0));
    return () => timers.forEach(clearTimeout);
  }, [full]);
  const text = welcome ? WELCOME : full;
  const shown = text.slice(0, n);
  const rest = text.slice(n);
  const part = (text: string, from: number) => {
    // the name sits between the lead and the "!"
    if (welcome) {
      // "you" is highlighted and blinks for 2 seconds once the message is fully typed
      const cut = WELCOME.length - 4; // "You."
      const head = text.slice(0, cut);
      const you = text.slice(cut);
      return [head, you && <span key="y" className={blinkYou ? "uf-you-blink" : undefined}>{you}</span>];
    }
    const out: React.ReactNode[] = [];
    const a = text.slice(0, Math.max(0, lead.length - from));
    const nameEnd = full.length; // the name and its "."
    const b = text.slice(a.length, Math.max(a.length, nameEnd - from));
    const c = text.slice(a.length + b.length);
    if (a) out.push(a);
    if (b) out.push(<span key="n" className={blink ? "uf-name-blink" : undefined}>{b}</span>);
    if (c) out.push(c);
    return out;
  };
  return (
    <span aria-label={full} className={welcome ? undefined : "text-[17px] font-semibold"}>
      <span aria-hidden>
        {part(shown, 0)}
        <span className="invisible">{rest}</span>
      </span>
    </span>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

// The top of Home on the phone: a clean white header (name and status pill on the left, search, bell and photo on the right, then
// "Hi, name!" with the account link), and under it one account card: name, number, points, status pills and the next game.
// A VIP customer keeps the dark blue card. Desktop keeps the profile card in components/UserBadge.tsx.
export default function HomeTop() {
  const session = useSession();
  const teams = useTeams();
  const club = clubStore.use().data;
  const profile = profileStore.use().data;
  const points = loyaltyStore.use().data?.remaining ?? null;
  const bookings = myBookingsStore.use().data ?? NONE;

  const [now] = useState(() => Date.now());
  // the points start hidden at every sign-in and every app start; showing them lasts until the tab is closed or the customer signs out
  const accountId = session?.registered ? session.id : "";
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const h = setTimeout(() => {
      try {
        if (!accountId) sessionStorage.removeItem(SHOW_KEY);
        setHidden(!accountId || sessionStorage.getItem(SHOW_KEY) !== accountId);
      } catch { /* storage blocked: stays hidden */ }
    }, 0);
    return () => clearTimeout(h);
  }, [accountId]);
  const toggleHidden = () => setHidden((v) => { try { if (v) sessionStorage.setItem(SHOW_KEY, accountId); else sessionStorage.removeItem(SHOW_KEY); } catch { /* not remembered */ } return !v; });
  const registered = Boolean(session?.registered);
  const name = session?.registered ? session.name : "Guest";
  const first = name.trim().split(/\s+/)[0];
  const captain = Boolean(session?.registered && teams?.mode === "captain");
  const vip = Boolean(session?.registered && profile?.vip);
  const member = Boolean(session?.registered && club?.member);
  const next = registered ? [...bookings].filter((b) => isUpcoming(b, now)).sort((a, b) => startsAtMs(a) - startsAtMs(b))[0] : undefined;

  const dark = vip;
  const logoRow = (
    <div className="flex items-center justify-between gap-3 -mx-5 rounded-b-3xl bg-[#e4efff] px-5 pb-3 pt-[max(calc(env(safe-area-inset-top)_+_0.75rem),1rem)] tab:mx-0 tab:rounded-3xl">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark-navy.png" alt="" aria-hidden className="h-9 w-auto shrink-0" />
        <span className="truncate text-[17px] font-extrabold uppercase leading-none tracking-tight text-[#0c0b5d]">Unique Futsal</span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 [&_button[aria-label^=Notifications]]:!h-11 [&_button[aria-label^=Notifications]]:!w-11 [&_button[aria-label^=Notifications]]:!bg-white [&_button[aria-label^=Notifications]]:!shadow-none [&_button[aria-label^=Notifications]]:!ring-0 [&_button[aria-label^=Notifications]]:!border-0">
        <NotificationBell />
      </div>
    </div>
  );

  // a guest or new visitor: no greeting and no account card; the banner, then an invitation to log in or create an account (no cards),
  // with the weather and date at the top (the quick icons are for registered customers only)
  if (!registered) {
    return (
      <div className="uf-plain order-1 -mx-5 -mt-5 bg-white px-5 pb-4 tab:mx-0 tab:mt-0 tab:rounded-3xl desk:contents">
        <div className="desk:hidden">
          {logoRow}
          {/* the banner, the weather and date just under it, then the invitation */}
          <div className="relative -mx-5 mt-3 overflow-hidden tab:mx-0"><MobileHero /></div>
          <LiveMatchStrip className="mt-3" />
          <div className="mt-3"><TodayCard compact /></div>
          <GuestPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="uf-plain order-1 -mx-5 -mt-5 bg-white px-5 pb-4 tab:mx-0 tab:mt-0 tab:rounded-3xl desk:contents">
      <div className="desk:hidden">
      <div className="flex items-center justify-between gap-3 -mx-5 rounded-b-3xl bg-[#e4efff] px-5 pb-3 pt-[max(calc(env(safe-area-inset-top)_+_0.75rem),1rem)] tab:mx-0 tab:rounded-3xl">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark-navy.png" alt="" aria-hidden className="h-9 w-auto shrink-0" />
          <span className="truncate text-[17px] font-extrabold uppercase leading-none tracking-tight text-[#0c0b5d]">Unique Futsal</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 [&_button[aria-label^=Notifications]]:!h-11 [&_button[aria-label^=Notifications]]:!w-11 [&_button[aria-label^=Notifications]]:!bg-white [&_button[aria-label^=Notifications]]:!shadow-none [&_button[aria-label^=Notifications]]:!ring-0">
          <NotificationBell />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-1.5 px-1">
        <p className="min-w-0 whitespace-nowrap text-sm font-medium leading-tight text-[#14142b]"><TypedGreeting first={first} /></p>
        <div className="shrink-0 text-right leading-none text-[#0c0b5d]">
          <div className="flex items-center justify-end gap-0.5 text-[15px] font-bold">
            <Link href="/points" aria-label="Loyalty points" className="flex items-center gap-1"><Star size={14} className="fill-[#f5822a] text-[#f5822a]" aria-hidden /> <span className="tabular-nums">{hidden ? "••••" : points === null ? "--" : fmtPts(points)}</span></Link>
            <button type="button" onClick={toggleHidden} aria-label={hidden ? "Show loyalty points" : "Hide loyalty points"} aria-pressed={hidden} className="flex h-6 w-6 items-center justify-center rounded-full !bg-transparent text-[#4b4b66]">{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <span className="block pr-1 text-[10px] font-medium text-[#4b4b66]">Loyalty points</span>
        </div>
      </div>
      </div>

      <section aria-label="My account" className={`order-1 mt-3 rounded-[1.75rem] border p-3.5 desk:hidden shadow-[0_8px_22px_-14px_rgba(12,11,93,0.5)] ${dark ? "border-[#0c0b5d] bg-gradient-to-br from-[#0c0b5d] via-[#08084a] to-[#050a2b] text-white" : "border-[#dcdcf0] bg-white text-[#14142b]"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-semibold leading-tight">
              <span className="truncate">{registered ? name : "Unique Futsal"}</span>
              {registered && <Link href="/profile" aria-label="Edit profile" className={dark ? "text-white/80" : "text-[#4b4b66]"}><Pencil size={15} /></Link>}
            </p>
            <p className={`mt-0.5 text-sm tabular-nums ${dark ? "text-white/75" : "text-[#6b6b80]"}`}>{session?.registered ? session.phone : site.phone}</p>
          </div>
          {registered && (
            <div className="flex shrink-0 items-center gap-1.5 [&>a]:!h-9 [&>a]:!w-9 [&>a]:!rounded-lg [&>button]:!h-9 [&>button]:!w-9 [&>button]:!rounded-lg [&>a]:!bg-[#eaf1ff] [&>button]:!bg-[#eaf1ff] [&>a]:!shadow-none [&>button]:!shadow-none [&>a>svg]:!h-[18px] [&>a>svg]:!w-[18px] [&>button>svg]:!h-[18px] [&>button>svg]:!w-[18px]"><WifiButton /><OrderButton /><RulesButton /><DigitalIdButton /></div>
          )}
        </div>

        {(vip || captain || member) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {vip && <span className="rounded-full border border-amber-300 bg-amber-100 px-3.5 py-1 text-base text-amber-800">VIP</span>}
            {captain && <span className="rounded-full border border-amber-300 bg-amber-100 px-3.5 py-1 text-base text-amber-800">Captain</span>}
            {member && <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-base text-indigo-800"><BadgeCheck size={15} aria-hidden /> Club</span>}
          </div>
        </div>
        )}

        {/* the weather and date, then the last games, inside the card (desktop shows them as their own cards, see HomeScreen) */}
        {/* the venue banner first (desktop shows it as the hero instead), the weather and date just under it */}
        <div className="relative -mx-3.5 mt-3 overflow-hidden desk:hidden"><MobileHero /></div>
        <LiveMatchStrip className="mt-3 desk:hidden" />
        <TodayCard inCard dark={dark} />
        <LastPlayed embedded dark={dark} />

        <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${dark ? "border-white/25" : "border-[#dcdcf0]"}`}>
          <div className="min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wide ${dark ? "text-white/70" : "text-[#6b6b80]"}`}>Next game</p>
            <p className={`mt-0.5 text-sm font-semibold leading-snug ${dark ? "text-white" : "text-[#14142b]"}`}>
              {!registered ? "Sign in to book" : next ? <>{dayFmt.format(parseKey(next.date))}, {formatHour(parseInt(next.startTime, 10))}</> : "No game booked"}
            </p>
          </div>
          <Link href={registered ? "/profile/bookings" : "/login"} className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium ${dark ? "border-white/40 text-white" : "border-[#dcdcf0] text-[#3345b0]"}`}>
            {registered ? "My Games" : "Sign in"} <ChevronDown size={16} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
