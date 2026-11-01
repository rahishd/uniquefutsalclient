"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { clubStore } from "@/lib/club";
import { profileStore } from "@/lib/profile";
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
  const profile = profileStore.use().data; // always called: a hook must not depend on the sign-in state
  const vip = Boolean(session?.registered && profile?.vip); // staff gave this customer a VIP code
  const clubMember = Boolean(session?.registered && club?.member); // active Unique Club member

  return (
    <div className={`order-1 mt-2 flex w-full min-w-0 items-center gap-3 rounded-3xl border p-2.5 desk:col-span-6 desk:mt-0 desk:p-4 ${vip
      ? "text-white border-white ring-2 ring-white/90 bg-gradient-to-br from-[#0c0b5d] via-[#08084a] to-[#050a2b] shadow-[0_8px_22px_-12px_rgba(12,11,93,0.8)]"
      : "text-[#0c0b5d] border-[#bfd7ff] bg-gradient-to-br from-[#eaf3ff] via-[#dbeaff] to-[#cbe0ff] ring-2 ring-white/80 shadow-[0_8px_22px_-12px_rgba(59,130,246,0.5)]"}`}>
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
        {session ? <ProfileAvatar name={name} captain={captain} size={44} src={session.registered ? session.avatar : null} /> : <span className="block h-11 w-11 shrink-0 rounded-full bg-white/60" />}
        <span className="min-w-0">
          <span className={`block text-xs ${vip ? "text-sky-100/85" : "text-[#3345b0]"}`}>
            {captain ? t("Captain") : t("Hello")} <span aria-hidden>👋</span>
          </span>
          <span className="block min-h-6 truncate text-lg font-medium leading-tight tab:text-2xl">{session ? name.trim().split(/\s+/)[0] : ""}</span>
          {clubMember && <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${vip ? "bg-white text-[#0c0b5d]" : "bg-white text-[#2c3da0]"}`}><BadgeCheck size={13} aria-hidden /> Club Member</span>}
        </span>
      </Link>
      <span className="shrink-0 [&>button]:!h-11 [&>button]:!w-11 [&>button]:!rounded-2xl [&>button]:!bg-white [&>button>svg]:!h-6 [&>button>svg]:!w-6"><DigitalIdButton /></span>
    </div>
  );
}

// The quick icons: one row of white round buttons, shown just under the weather and date on Home.
export function QuickIcons() {
  return (
    <div className="order-1 mt-2.5 flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl bg-white px-2.5 py-2.5 shadow-[0_8px_20px_-12px_rgba(59,130,246,0.45)] ring-1 ring-[#bfd7ff] desk:col-span-6 desk:mt-3 desk:justify-start desk:gap-5 desk:rounded-none desk:bg-transparent desk:p-0 desk:px-1 desk:shadow-none desk:ring-0 [&>a]:!h-12 [&>a]:!w-12 [&>a]:!rounded-2xl [&>a]:!bg-[#eaf1ff] [&>a]:!shadow-none [&>a>svg]:!h-6 [&>a>svg]:!w-6 [&>button]:!h-12 [&>button]:!w-12 [&>button]:!rounded-2xl [&>button]:!bg-[#eaf1ff] [&>button]:!shadow-none [&>button>svg]:!h-6 [&>button>svg]:!w-6 desk:[&>a]:!bg-white desk:[&>a]:!shadow-[0_4px_10px_-3px_rgba(12,11,93,0.3)] desk:[&>button]:!bg-white desk:[&>button]:!shadow-[0_4px_10px_-3px_rgba(12,11,93,0.3)] lg:[&>a]:!h-14 lg:[&>a]:!w-14 lg:[&>button]:!h-14 lg:[&>button]:!w-14 lg:[&>a>svg]:!h-7 lg:[&>a>svg]:!w-7 lg:[&>button>svg]:!h-7 lg:[&>button>svg]:!w-7">
        <OrderButton />
        <WifiButton />
        <RulesButton />
        <WhatsAppChat />
      </div>
  );
}
