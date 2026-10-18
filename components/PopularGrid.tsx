"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, ChevronRight, CircleHelp, Crown, Gamepad2, Gift, GraduationCap, HeartHandshake, MessageSquareWarning, Star, Swords, Tag, Trophy, UserSearch, Zap, BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import EvCarIcon from "@/components/ev/EvCarIcon";
import { markReadByTypes, noticesStore, type NoticeType } from "@/lib/notifications";
import { openSignIn, useSession } from "@/lib/session";
import { pendingActions, useTeams } from "@/lib/teams";
import { useT } from "@/lib/i18n";

interface Tile {
  label: string;
  href: string;
  icon: React.ElementType;
  tone: string;
  // Unread messages of these types show as the tile's badge. Opening the tile marks them read.
  types?: NoticeType[];
  // The Opponent tile is action based: it counts challenges and results waiting for the captain.
  actions?: boolean;
}

// Every tile wears a "New" tag except the long-standing ones, and nobody who has signed in more than this many times sees it.
const NEW_TAG_LOGINS = 5;
const NO_NEW_TAG = new Set(["Book", "Gamezone", "Points", "Tournaments"]);

const TILES: Tile[] = [
  { label: "Book", href: "/book", icon: CalendarDays, tone: "text-brand", types: ["booking", "reminder", "payment"] },
  { label: "Gamezone", href: "/gamezone", icon: Gamepad2, tone: "text-brand", types: ["gamezone"] },
  { label: "Opponent", href: "/opponent", icon: Swords, tone: "text-brand", actions: true },
  { label: "Find Player", href: "/find-player", icon: UserSearch, tone: "text-brand", types: ["players"] },
  { label: "Unique Club", href: "/club", icon: BadgeCheck, tone: "text-brand" },
  { label: "Membership", href: "/member", icon: Crown, tone: "text-brand", types: ["membership"] },
  { label: "Gift Card", href: "/gift-card", icon: Gift, tone: "text-brand" },
  { label: "EV Charging", href: "/ev", icon: EvCarIcon, tone: "text-brand" },
  { label: "Points", href: "/points", icon: Star, tone: "text-brand", types: ["points"] },
  { label: "My stats", href: "/profile", icon: BarChart3, tone: "text-brand" },
  { label: "Tournaments", href: "/tournaments", icon: Trophy, tone: "text-brand", types: ["tournament"] },
  { label: "Promos", href: "/promos", icon: Tag, tone: "text-brand", types: ["promo"] },
  { label: "Complaints", href: "/complaints", icon: MessageSquareWarning, tone: "text-brand", types: ["complaint"] },
  { label: "Children's Academy", href: "/academy", icon: GraduationCap, tone: "text-brand", types: ["academy"] },
  { label: "Refer & Earn", href: "/refer", icon: HeartHandshake, tone: "text-brand", types: ["referral"] },
  { label: "Verify Documents", href: "/verify", icon: ShieldCheck, tone: "text-brand" },
  { label: "Help", href: "/help", icon: CircleHelp, tone: "text-brand" },
];

// A guest (no account) can book a court and Gamezone, and read Help. Everything else needs an account.
const GUEST_OK = new Set(["/book", "/gamezone", "/help", "/verify"]);

const NO_UNREAD: Partial<Record<NoticeType, number>> = {};

export default function PopularGrid() {
  const unread = noticesStore.use().data?.unreadByType ?? NO_UNREAD;
  const teams = useTeams();
  const session = useSession();
  const guest = session?.registered !== true;
  // someone who has signed in more than 5 times knows their way around: no "New" tags for them
  const showNew = !(session?.registered && (session.logins ?? 0) > NEW_TAG_LOGINS);
  const tr = useT();

  function countFor(t: Tile) {
    if (t.actions) {
      // challenges to answer and results to approve; only a registered captain has these
      return session?.registered && teams?.mode === "captain" ? pendingActions(teams) : 0;
    }
    if (!t.types) return 0;
    return t.types.reduce((sum, ty) => sum + (unread[ty] ?? 0), 0);
  }

  return (
    <section className="mt-8 desk:mt-10">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-[#0c0b5d] desk:text-xl">
          <Zap size={16} strokeWidth={2.2} className="text-brand" aria-hidden />
          {tr("Quick Access")}
        </h2>
        <Link href="/profile" className="flex items-center text-sm text-brand">
          {tr("See all")} <ChevronRight size={16} />
        </Link>
      </div>
      {guest && session !== undefined && (
        <div role="note" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sky-100 px-4 py-3 text-sm text-[#0c0b5d]">
          <span className="flex items-center gap-2 font-medium"><Lock size={15} aria-hidden /> {tr("Please register to access all locked features.")}</span>
          <button type="button" onClick={openSignIn} className="rounded-full bg-[#0c0b5d] px-4 py-1.5 text-xs font-semibold" style={{ color: "#ffffff" }}>{tr("Register / Sign in")}</button>
        </div>
      )}
      <ul className="mt-4 grid grid-cols-4 gap-x-3 gap-y-5 desk:grid-cols-6 desk:gap-x-4 desk:gap-y-6">
        {TILES.map((t) => {
          const count = countFor(t);
          const Icon = t.icon;
          const locked = guest && !GUEST_OK.has(t.href);
          const face = (
            <>
              <span className={`relative flex h-[70px] w-[70px] items-center justify-center rounded-[22px] bg-gradient-to-br from-white to-sky-50 shadow-[0_12px_22px_-14px_rgba(59,130,246,0.7)] ring-1 ring-sky-100 transition-transform group-active:scale-95 desk:h-24 desk:w-24 desk:group-hover:-translate-y-1 ${locked ? "opacity-60" : ""}`}>
                <Icon className={`${t.tone} h-[30px] w-[30px] desk:h-10 desk:w-10`} />
                {locked && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow ring-2 ring-white">
                    <Lock size={12} />
                  </span>
                )}
                {showNew && !NO_NEW_TAG.has(t.label) && (
                  <span aria-hidden className="absolute -left-2 -top-2 rounded-full bg-gradient-to-r from-[#f5822a] to-[#ff9a4d] px-1.5 py-px text-[8px] font-extrabold uppercase leading-[14px] tracking-wider text-white shadow-md ring-2 ring-white">
                    {tr("New")}
                  </span>
                )}
                {!locked && count > 0 && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white shadow ring-2 ring-white">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span className="text-center text-xs font-medium text-slate-700 desk:text-sm">{tr(t.label)}</span>
            </>
          );
          return (
            <li key={t.label}>
              {locked ? (
                <button type="button" onClick={openSignIn} aria-label={`${t.label}: sign in to use`} className="group flex w-full flex-col items-center gap-2">
                  {face}
                </button>
              ) : (
                <Link
                  href={t.href}
                  onClick={() => t.types && markReadByTypes(t.types)}
                  aria-label={count > 0 ? `${t.label}, ${count} new` : t.label}
                  className="group flex flex-col items-center gap-2"
                >
                  {face}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
