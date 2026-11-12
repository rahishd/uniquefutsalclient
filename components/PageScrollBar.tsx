"use client";

// Phone, every page except Home: a slim bar with the logo, the points and the bell that is NOT there when a page opens. It slides down only while you
// scroll DOWN within the page, and is gone the very moment you scroll UP (or are back at the top). It starts hidden on every new page
// (CompanyHeader gives it the page address as its key, so it begins again each time). Home has its own, see components/StickyHomeBar.tsx.
import { useEffect, useState } from "react";
import NotificationBell from "@/components/NotificationBell";
import HeaderPoints from "@/components/HeaderPoints";
import { site } from "@/lib/site";

const AFTER = 60; // px from the top before scrolling down shows the bar
const DOWN = 8; // how far down (px) counts as scrolling down
const UP = 2; // how far up (px) counts as scrolling up

export default function PageScrollBar() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (y < AFTER) setShown(false);
      else if (y - last > DOWN) setShown(true);
      else if (last - y > UP) setShown(false);
      if (Math.abs(y - last) > UP) last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div
      aria-hidden={!shown}
      // sliding in takes a moment; going away is instant (no transition while hidden)
      className={`fixed inset-x-0 z-40 border-b border-[#cfe0fa] bg-[#e4efff] text-[#0c0b5d] shadow-[0_6px_16px_-10px_rgba(12,11,93,0.35)] desk:hidden ${
        shown ? "translate-y-0 transition-transform duration-200 ease-out" : "pointer-events-none -translate-y-full opacity-0 transition-none"
      }`}
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
