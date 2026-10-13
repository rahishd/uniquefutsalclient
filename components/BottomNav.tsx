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

export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const bookActive = isActive("/book");

  const sideTab = ({ label, href, icon: Icon }: (typeof LEFT_TABS)[number]) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex w-14 flex-col items-center gap-0.5"
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
            active ? "glass-active text-white" : "bg-white/40 text-brand"
          }`}
        >
          <Icon size={16} strokeWidth={active ? 2.2 : 1.9} />
        </span>
        <span className={`text-[9px] font-medium leading-none ${active ? "text-brand" : "text-slate-400"}`}>{t(label)}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 px-5 desk:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      <div className="glass mx-auto flex max-w-md items-stretch justify-between overflow-hidden rounded-3xl px-2">
        {LEFT_TABS.map((tab) => <span key={tab.href} className="py-[3px]">{sideTab(tab)}</span>)}

        {/* Book Now: a square navy block set into the bar, full height, no ring and no float */}
        <Link
          href="/book"
          aria-label="Book Now"
          aria-current={bookActive ? "page" : undefined}
          className={`flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-none bg-[#0c0b5d] text-white transition-colors ${
            bookActive ? "bg-[#17168a]" : "hover:bg-[#17168a]"
          }`}
        >
          <CalendarDays size={18} strokeWidth={2} />
          <span className="text-[10px] font-semibold leading-none tracking-wide">{t("Book Now")}</span>
        </Link>

        {RIGHT_TABS.map((tab) => <span key={tab.href} className="py-[3px]">{sideTab(tab)}</span>)}
      </div>
    </nav>
  );
}
