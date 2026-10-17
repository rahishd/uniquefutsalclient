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
  const path = usePathname();
  const home = path === "/";
  // the sign-in page needs no greeting bar: the person is not signed in yet
  const signIn = path === "/login" || path.startsWith("/login/");
  return (
    <>
      {!home && !signIn && <PageInfoBar />}
      <div className={`${home ? "" : "hidden desk:block "}sticky top-0 z-30 short:static bg-gradient-to-b from-white to-slate-50/80 shadow-[0_8px_24px_-14px_rgba(12,11,93,0.45)] backdrop-blur`} style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-md px-5 tab:max-w-3xl tab:px-8 desk:max-w-none desk:px-10">
        <div className="flex min-h-16 items-center gap-3 py-2 tab:min-h-14 tab:gap-4 short:min-h-12 short:py-1 pr-1 desk:gap-3 2xl:gap-6">
          <Link href="/" aria-label={`${site.name} home`} className="flex min-w-0 items-center gap-2.5 desk:shrink-0">
            {/* The logo picture is white on navy; it stays a small navy tile, so the player reads as a white mark. */}
            <span
              aria-hidden
              className="uf-hdr-logo shrink-0 rounded-xl bg-[#0c0b5d] bg-no-repeat shadow-md ring-2 ring-white"
              style={{
                backgroundImage: "url(/logo.jpg)",
                backgroundBlendMode: "lighten",
              }}
            />
            <span className="flex h-16 min-w-0 flex-col justify-between tab:h-auto tab:justify-center tab:gap-0.5">
              <span className="block whitespace-nowrap text-lg font-extrabold uppercase leading-tight tracking-wide text-brand tab:text-xl desk:max-xl:hidden">{site.name}</span>
              <span className="block text-xs font-normal leading-snug tracking-wide text-slate-600 desk:max-2xl:hidden">Connecting Players.<br className="tab:hidden" />{" "}Contributing Fitness</span>
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
