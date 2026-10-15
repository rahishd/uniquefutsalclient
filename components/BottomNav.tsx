"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, User, Gamepad2, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { unreadStore } from "@/lib/chat";

const LEFT_TABS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Gamezone", href: "/gamezone", icon: Gamepad2 },
];
const RIGHT_TABS = [
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Profile", href: "/profile", icon: User },
];

// Clean white bar along the bottom: an outlined icon and a small label per tab, the current one in dark blue.
// Book Now sits in the same row and looks like the other tabs.
export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const unread = unreadStore.use().data ?? 0;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const bookActive = isActive("/book");

  const sideTab = ({ label, href, icon: Icon }: (typeof LEFT_TABS)[number]) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 ${active ? "text-brand" : "text-slate-400"}`}
      >
        <span className="relative">
          <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
          {href === "/chat" && unread > 0 && (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{t(label)}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-6px_20px_rgba(15,23,42,0.06)] desk:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {LEFT_TABS.map(sideTab)}

        {/* Book Now: same look as the other tabs */}
        <Link
          href="/book"
          aria-label="Book Now"
          aria-current={bookActive ? "page" : undefined}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 ${bookActive ? "text-brand" : "text-slate-400"}`}
        >
          <CalendarDays size={21} strokeWidth={bookActive ? 2.3 : 1.8} />
          <span className={`text-[10px] leading-none ${bookActive ? "font-semibold" : "font-medium"}`}>{t("Book Now")}</span>
        </Link>

        {RIGHT_TABS.map(sideTab)}
      </div>
    </nav>
  );
}
