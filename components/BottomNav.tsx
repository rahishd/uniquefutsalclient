"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, User, Gamepad2, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { unreadStore } from "@/lib/chat";

const TABS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Gamezone", href: "/gamezone", icon: Gamepad2 },
  { label: "Book Now", href: "/book", icon: CalendarDays },
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Profile", href: "/profile", icon: User },
];

// A floating, frosted bar at the bottom. The current tab is a light blue pill with its name (.glass-active, the same
// "selected" look as chips and option cards across the app); the others show their icon
// (the name is still read out by screen readers and shown as a tooltip).
export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const unread = unreadStore.use().data ?? 0;
  // the sign-in page is a clean card on its own
  if (pathname === "/login" || pathname.startsWith("/login/")) return null;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-0 desk:hidden">
      <div className="pointer-events-auto flex w-full items-center justify-between gap-1 border-t border-sky-100 bg-white px-2 pb-[calc(env(safe-area-inset-bottom)+2px)] pt-1.5 short:pt-1 shadow-[0_-8px_24px_-14px_rgba(15,23,42,0.25)]">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={t(label)}
              title={t(label)}
              className={`relative flex h-12 short:h-10 items-center justify-center gap-2 rounded-[20px] transition-all duration-300 ${
                active
                  ? "glass-active flex-[1.9] px-4 text-[#0c0b5d]"
                  : "flex-1 text-slate-400 hover:text-[#0c0b5d]"
              }`}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={active ? 2.3 : 1.9} />
                {href === "/chat" && unread > 0 && (
                  <span className="absolute -right-3 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white shadow ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {active && <span className="whitespace-nowrap text-[13px] font-semibold">{t(label)}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
