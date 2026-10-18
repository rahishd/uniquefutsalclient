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
    <div className="flex min-w-0 items-center gap-3">
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
        {session ? <ProfileAvatar name={name} captain={captain} size={56} src={session.registered ? session.avatar : null} /> : <span className="block h-14 w-14 shrink-0 rounded-full bg-white/60" />}
        <span className="min-w-0">
          <span className="block text-sm text-slate-400">
            {captain ? t("Captain") : t("Hello")} <span aria-hidden>👋</span>
          </span>
          <span className="block min-h-8 text-2xl font-medium leading-tight">{session ? name : ""}</span>
        </span>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <DigitalIdButton />
          <WifiButton />
          <WhatsAppChat />
        </div>
        {session?.registered && (
          <Link
            href="/points"
            aria-label={points === null ? "Loyalty points" : `${fmtPts(points)} loyalty points available`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0c0b5d] px-3 py-1 font-bold text-white shadow-sm"
          >
            <Star size={14} className="fill-current" />
            <span className="text-base font-extrabold leading-none tabular-nums">{points === null ? "--" : fmtPts(points)}</span>
            <span className="text-xs font-semibold">pts</span>
          </Link>
        )}
      </div>
    </div>
  );
}
