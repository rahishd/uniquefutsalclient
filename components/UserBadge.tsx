"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { clubStore } from "@/lib/club";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { useT } from "@/lib/i18n";
import DigitalIdButton from "@/components/digitalid/DigitalIdButton";
import WifiButton from "@/components/wifi/WifiButton";
import OrderButton from "@/components/order/OrderButton";
import RulesButton from "@/components/rules/RulesButton";
import WhatsAppChat from "@/components/WhatsAppChat";

// Top-left of the home header: the signed-in customer (with the (C) badge in Captain mode), or "Guest".
export default function UserBadge() {
  const session = useSession();
  const teams = useTeams();
  const t = useT();
  const name = session?.registered ? session.name : "Guest";
  const captain = Boolean(session?.registered && teams?.mode === "captain");
  const club = clubStore.use().data;
  const clubMember = Boolean(session?.registered && club?.member); // active Unique Club member

  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
        {session ? <ProfileAvatar name={name} captain={captain} size={56} src={session.registered ? session.avatar : null} /> : <span className="block h-14 w-14 shrink-0 rounded-full bg-white/60" />}
        <span className="min-w-0">
          <span className="block text-sm text-[#1e3a8a]/70">
            {captain ? t("Captain") : t("Hello")} <span aria-hidden>👋</span>
          </span>
          <span className="block min-h-8 truncate text-xl font-medium leading-tight tab:text-2xl">{session ? name : ""}</span>
          {clubMember && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#0c0b5d] px-2.5 py-0.5 text-[11px] font-semibold text-white"><BadgeCheck size={13} aria-hidden /> Club Member</span>}
        </span>
      </Link>
      {/* the quick icons: a 2 x 2 block of white round buttons on phones and tablets; one big row on desktop */}
      <div className="ml-auto grid shrink-0 grid-cols-2 place-items-center gap-2.5 [&>a]:!h-12 [&>a]:!w-12 [&>a]:!bg-white [&>a]:!shadow-[0_4px_10px_-3px_rgba(12,11,93,0.3)] [&>a>svg]:!h-6 [&>a>svg]:!w-6 [&>button]:!h-12 [&>button]:!w-12 [&>button]:!bg-white [&>button]:!shadow-[0_4px_10px_-3px_rgba(12,11,93,0.3)] [&>button>svg]:!h-6 [&>button>svg]:!w-6 tab:gap-3 lg:flex lg:gap-4 lg:[&>a]:!h-14 lg:[&>a]:!w-14 lg:[&>button]:!h-14 lg:[&>button]:!w-14 lg:[&>a>svg]:!h-7 lg:[&>a>svg]:!w-7 lg:[&>button>svg]:!h-7 lg:[&>button>svg]:!w-7">
        <DigitalIdButton />
        <OrderButton />
        <WifiButton />
        <RulesButton />
        <WhatsAppChat />
      </div>
    </div>
  );
}
