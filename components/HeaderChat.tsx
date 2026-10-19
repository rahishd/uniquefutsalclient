"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { unreadStore } from "@/lib/chat";

// Desktop header: the Chat button, a white frosted-glass pill just left of the bell. (Phones have Chat in the bottom bar.)
export default function HeaderChat() {
  const pathname = usePathname();
  const t = useT();
  const unread = unreadStore.use().data ?? 0;
  const active = pathname === "/chat" || pathname.startsWith("/chat/");
  return (
    <Link
      href="/chat"
      aria-current={active ? "page" : undefined}
      aria-label={unread > 0 ? `${t("Chat")}, ${unread}` : t("Chat")}
      className={`uf-header-chat relative hidden items-center gap-2 whitespace-nowrap rounded-full border border-white/70 px-4 py-2 text-sm font-semibold !text-[#0c0b5d] shadow-[0_4px_16px_-4px_rgba(255,255,255,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md transition hover:bg-white desk:flex ${active ? "bg-white" : "bg-white/85"}`}
    >
      <MessageCircle size={18} strokeWidth={2.2} />
      {t("Chat")}
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0c0b5d]">{unread > 9 ? "9+" : unread}</span>
      )}
    </Link>
  );
}
