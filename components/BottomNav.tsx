"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, User, Swords, Gamepad2 } from "lucide-react";
import { useT } from "@/lib/i18n";

const LEFT_TABS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Opponent", href: "/opponent", icon: Swords },
];
const RIGHT_TABS = [
  { label: "Gamezone", href: "/gamezone", icon: Gamepad2 },
  { label: "Profile", href: "/profile", icon: User },
];

// Clean white bar along the bottom: an outlined icon and a small label per tab, the current one in dark blue.
// Book Now is a square dark-blue block set into the middle of the bar.
export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();
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
        <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
        <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{t(label)}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-[0_-6px_20px_rgba(15,23,42,0.06)] desk:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {LEFT_TABS.map(sideTab)}

        {/* Book Now: a square dark-blue block set into the bar */}
        <Link
          href="/book"
          aria-label="Book Now"
          aria-current={bookActive ? "page" : undefined}
          className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 bg-[#0c0b5d] text-white"
        >
          <CalendarDays size={20} strokeWidth={2} />
          <span className="text-[10px] font-semibold leading-none tracking-wide">{t("Book Now")}</span>
        </Link>

        {RIGHT_TABS.map(sideTab)}
      </div>
    </nav>
  );
}
