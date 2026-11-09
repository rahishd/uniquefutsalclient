"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { unreadStore } from "@/lib/chat";

// Desktop header: the Chat link, plain text with a small icon, just left of the bell. (Phones have Chat in the bottom bar.)
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
      className={`relative hidden items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-xs !bg-transparent transition-colors desk:flex ${active ? "font-semibold text-white" : "font-medium text-white/85 hover:text-white"}`}
    >
      <MessageCircle size={14} strokeWidth={2.2} />
      {t("Chat")}
      {unread > 0 && (
        <span className="absolute -right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0c0b5d]">{unread > 9 ? "9+" : unread}</span>
      )}
    </Link>
  );
}
