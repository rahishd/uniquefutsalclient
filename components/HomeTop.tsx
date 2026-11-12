"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, ChevronDown, Eye, EyeOff, Pencil, Star } from "lucide-react";
import { clubStore } from "@/lib/club";
import { profileStore } from "@/lib/profile";
import { loyaltyStore } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";
import { formatHour, isUpcoming, myBookingsStore, parseKey, startsAtMs } from "@/lib/booking";
import { useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import LastPlayed from "@/components/LastPlayed";
import TodayCard from "@/components/TodayCard";
import LiveMatchStrip from "@/components/LiveMatchStrip";
import { MobileHero } from "@/components/DeskHero";
import GuestPrompt from "@/components/GuestPrompt";
import NotificationBell from "@/components/NotificationBell";
import DigitalIdButton from "@/components/digitalid/DigitalIdButton";
import WifiButton from "@/components/wifi/WifiButton";
import OrderButton from "@/components/order/OrderButton";

const NONE: never[] = [];
const SHOW_KEY = "uf_show_points";
// Desktop, on the hero picture (passed into components/DeskHero.tsx): five short lines typed one after the other, 2 seconds each, on one row (no name is shown):
// "Book Now.", "For Today.", "For Tomorrow.", "Anywhere.", "Anytime.", and round again. With "reduce motion" on nothing is typed: the lines just swap every 2 seconds.
const DESK_LINES = ["Book Now.", "For Today.", "For Tomorrow.", "Anywhere.", "Anytime."];
const LINE_MS = 2000; // how long each line stays (typing it takes about the first half)
function DeskTyping() {
  const [line, setLine] = useState("");
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const round = () => {
      DESK_LINES.forEach((text, i) => {
        const at = i * LINE_MS;
        if (reduce) { timers.push(setTimeout(() => setLine(text), at)); return; }
        const step = Math.min(900, text.length * 75) / text.length;
        timers.push(setTimeout(() => setLine(""), at));
        for (let k = 1; k <= text.length; k++) timers.push(setTimeout(() => setLine(text.slice(0, k)), at + step * k));
      });
      timers.push(setTimeout(round, DESK_LINES.length * LINE_MS));
    };
    timers.push(setTimeout(round, 0));
    return () => timers.forEach(clearTimeout);
  }, []);
  // the longest line is kept in place (invisible), so nothing around it moves while the text is typed
  return (
    <span className="relative inline-block whitespace-nowrap" aria-label={DESK_LINES.join(" ")}>
      <span aria-hidden className="invisible">For Tomorrow.</span>
      <span aria-hidden className="absolute left-0 top-0">{line}<span className="uf-caret ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.12em] bg-white/90" /></span>
    </span>
  );
}

export function DeskGreeting({ className = "" }: { className?: string }) {
  return <p className={`whitespace-nowrap text-[clamp(1.3rem,2.2vw,2.1rem)] font-bold leading-none ${className}`}><DeskTyping /></p>;
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
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight text-[#14142b]">
            <span className="truncate">{name}</span>
            {registered && <Link href="/profile" aria-label="Edit profile" className="text-[#4b4b66]"><Pencil size={14} /></Link>}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-[#6b6b80]">{session?.registered ? session.phone : ""}</p>
        </div>
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
        <div className="flex items-start justify-start gap-3">
          {registered && (
            <div className="flex w-full items-stretch gap-2"><WifiButton text="Wi-Fi" /><OrderButton text="Order" /><DigitalIdButton text="Digital ID" /></div>
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

        {/* the next game: a calm solid navy card, white text, no accent colours */}
        <div className="relative mt-3 flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-3.5 py-3 shadow-[0_10px_22px_-16px_rgba(12,11,93,0.7)]" style={{ background: "#0c0b5d", color: "#ffffff" }}>
          <div className="relative flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff" }}><CalendarClock size={22} aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.65)" }}>Next game</p>
              <p className="mt-0.5 text-[15px] font-bold leading-snug" style={{ color: "#ffffff" }}>
                {!registered ? "Sign in to book" : next ? <>{dayFmt.format(parseKey(next.date))}, {formatHour(parseInt(next.startTime, 10))}</> : "No game booked"}
              </p>
            </div>
          </div>
          <Link href={registered ? "/profile/bookings" : "/login"} className="relative inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-sm font-bold" style={{ background: "#ffffff", color: "#0c0b5d" }}>
            {registered ? "My Games" : "Sign in"} <ChevronDown size={16} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
