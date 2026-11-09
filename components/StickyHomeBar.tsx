"use client";

// On the phone Home page, a slim white bar with the name, points and bell that stays at the top of the screen once the
// profile card has scrolled away. It slides down when you scroll past the card and slides back up when you return to the top.
import { useEffect, useState } from "react";
import NotificationBell from "@/components/NotificationBell";
import HeaderPoints from "@/components/HeaderPoints";
import { site } from "@/lib/site";

const SHOW_AFTER = 140; // px scrolled before the bar appears

export default function StickyHomeBar() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const on = () => setShown(window.scrollY > SHOW_AFTER);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 top-0 z-40 border-b border-[#cfe0fa] bg-[#e4efff] text-[#0c0b5d] shadow-[0_6px_16px_-10px_rgba(12,11,93,0.35)] transition-all duration-300 ease-out desk:hidden ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
      style={{ paddingTop: "max(calc(env(safe-area-inset-top) - 0.625rem), 0.5rem)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/logo-mark-navy.png" alt="" aria-hidden className="h-7 w-auto shrink-0" />
          <span className="whitespace-nowrap text-sm font-extrabold uppercase tracking-wide">{site.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <HeaderPoints />
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
