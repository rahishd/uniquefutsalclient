"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { useT } from "@/lib/i18n";
import DigitalIdButton from "@/components/digitalid/DigitalIdButton";
import WifiButton from "@/components/wifi/WifiButton";
import WhatsAppChat from "@/components/WhatsAppChat";
import { loyaltyStore } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";
import { Star } from "lucide-react";

// Top-left of the home header: the signed-in customer (with the (C) badge in Captain mode), or "Guest".
export default function UserBadge() {
  const session = useSession();
  const teams = useTeams();
  const t = useT();
  const name = session?.registered ? session.name : "Guest";
  const captain = Boolean(session?.registered && teams?.mode === "captain");
  const points = loyaltyStore.use().data?.remaining ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 items-center gap-3">
    <Link href="/profile" className="flex items-center gap-3">
      {session ? <ProfileAvatar name={name} captain={captain} size={56} src={session.registered ? session.avatar : null} /> : <span className="h-14 w-14 rounded-full bg-white/60" />}
      <span>
        <span className="block text-sm text-slate-400">
          {captain ? t("Captain") : t("Hello")} <span aria-hidden>👋</span>
        </span>
        <span className="block min-h-8 text-2xl font-medium leading-tight">{session ? name : ""}</span>
      </span>
    </Link>
    <DigitalIdButton />
    <WifiButton />
    <WhatsAppChat />
    </div>
    {session?.registered && (
      <Link
        href="/points"
        aria-label={points === null ? "Loyalty points" : `${fmtPts(points)} loyalty points available`}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#0c0b5d] px-4 py-2.5 font-bold text-white shadow-sm"
      >
        <span className="flex items-center gap-2 text-sm font-semibold"><Star size={16} className="fill-current" /> Available points</span>
        <span className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold leading-none tabular-nums">{points === null ? "--" : fmtPts(points)}</span>
          <span className="text-xs font-bold text-white">pts</span>
        </span>
      </Link>
    )}
    </div>
  );
}
