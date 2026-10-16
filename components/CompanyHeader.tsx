"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import AdStrip from "@/components/ads/AdStrip";
import DeskNav from "@/components/DeskNav";
import HeaderToggles from "@/components/HeaderToggles";
import NotificationBell from "@/components/NotificationBell";
import PageInfoBar from "@/components/PageInfoBar";

// Top bar: clean and white. The logo and name sit on the left with some air around them, and the theme, language and
// notification buttons on the right. It stays pinned while the page scrolls.
// On the phone the full bar is shown on Home only; every other page shows a slim bar instead (greeting, Nepali date,
// temperature and the bell: components/PageInfoBar.tsx). In desktop mode (see `desk:` in globals.css) the bar is on every page, because it
// carries the main navigation there (the bottom bar is hidden).
export default function CompanyHeader() {
  const home = usePathname() === "/";
  return (
    <>
      {!home && <PageInfoBar />}
      <div className={`${home ? "" : "hidden desk:block "}sticky top-0 z-30 bg-gradient-to-b from-white to-slate-50/80 shadow-[0_8px_24px_-14px_rgba(12,11,93,0.45)] backdrop-blur`} style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-md px-5 desk:max-w-none desk:px-10">
        <div className="flex min-h-16 items-center gap-3 py-2 pr-1 desk:gap-3 2xl:gap-6">
          <Link href="/" aria-label={`${site.name} home`} className="flex min-w-0 items-center gap-2.5 desk:shrink-0">
            {/* The logo picture is white on navy; it stays a small navy tile, so the player reads as a white mark. */}
            <span
              aria-hidden
              className="h-16 w-16 shrink-0 rounded-xl bg-[#0c0b5d] bg-no-repeat shadow-md ring-2 ring-white"
              style={{
                backgroundImage: "url(/logo.jpg)",
                backgroundSize: "110px 110px",
                backgroundPosition: "-20px -7px",
                backgroundBlendMode: "lighten",
              }}
            />
            <span className="flex h-16 min-w-0 flex-col justify-between">
              <span className="block whitespace-nowrap text-lg font-extrabold uppercase leading-tight tracking-wide text-brand desk:max-xl:hidden">{site.name}</span>
              <span className="block text-xs font-normal leading-snug tracking-wide text-slate-600 desk:max-2xl:hidden">Connecting Players.<br />Contributing Fitness</span>
            </span>
          </Link>
          <DeskNav />
          <HeaderToggles />
          <div className="-mr-2 shrink-0"><NotificationBell /></div>
        </div>
        <div className="empty:hidden pb-2"><AdStrip placement="header" /></div>
      </div>
    </div>
    </>
  );
}
