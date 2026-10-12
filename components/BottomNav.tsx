"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, User, Swords, Gamepad2 } from "lucide-react";

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
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const bookActive = isActive("/book");

  const sideTab = ({ label, href, icon: Icon }: (typeof LEFT_TABS)[number]) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex w-14 flex-col items-center gap-1"
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
            active ? "glass-active text-white" : "bg-white/40 text-brand"
          }`}
        >
          <Icon size={20} strokeWidth={active ? 2.2 : 1.9} />
        </span>
        <span className={`text-[10px] font-medium ${active ? "text-brand" : "text-slate-400"}`}>{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 px-5 desk:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
    >
      <div className="glass mx-auto flex max-w-md items-stretch justify-between overflow-hidden rounded-3xl px-2">
        {LEFT_TABS.map((t) => <span key={t.href} className="py-2.5">{sideTab(t)}</span>)}

        {/* Book Now: a square navy block set into the bar, full height, no ring and no float */}
        <Link
          href="/book"
          aria-label="Book Now"
          aria-current={bookActive ? "page" : undefined}
          className={`flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-none bg-[#0c0b5d] text-white transition-colors ${
            bookActive ? "bg-[#17168a]" : "hover:bg-[#17168a]"
          }`}
        >
          <CalendarDays size={26} strokeWidth={2} />
          <span className="text-[11px] font-semibold tracking-wide">Book Now</span>
        </Link>

        {RIGHT_TABS.map((t) => <span key={t.href} className="py-2.5">{sideTab(t)}</span>)}
      </div>
    </nav>
  );
}
