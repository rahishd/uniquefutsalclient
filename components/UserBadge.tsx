"use client";

import Link from "next/link";
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

  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
        {session ? <ProfileAvatar name={name} captain={captain} size={56} src={session.registered ? session.avatar : null} /> : <span className="block h-14 w-14 shrink-0 rounded-full bg-white/60" />}
        <span className="min-w-0">
          <span className="block text-sm text-slate-400">
            {captain ? t("Captain") : t("Hello")} <span aria-hidden>👋</span>
          </span>
          <span className="block min-h-8 text-xl font-medium leading-tight [overflow-wrap:anywhere] tab:text-2xl">{session ? name : ""}</span>
        </span>
      </Link>
      {/* the quick icons: 3 across, 2 rows on phones and tablets; one big row on desktop */}
      <div className="ml-auto grid shrink-0 grid-cols-3 place-items-center gap-x-2 gap-y-2 [&>a]:!h-8 [&>a]:!w-8 [&>button]:!h-8 [&>button]:!w-8 tab:gap-x-2.5 tab:gap-y-2.5 tab:[&>a]:!h-9 tab:[&>a]:!w-9 tab:[&>button]:!h-9 tab:[&>button]:!w-9 lg:flex lg:gap-4 lg:[&>a]:!h-14 lg:[&>a]:!w-14 lg:[&>button]:!h-14 lg:[&>button]:!w-14 lg:[&>a>svg]:!h-7 lg:[&>a>svg]:!w-7 lg:[&>button>svg]:!h-7 lg:[&>button>svg]:!w-7">
        <DigitalIdButton />
        <OrderButton />
        <WifiButton />
        <RulesButton />
        <WhatsAppChat />
      </div>
    </div>
  );
}
