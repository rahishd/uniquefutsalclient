"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import AdStrip from "@/components/ads/AdStrip";
import DeskNav from "@/components/DeskNav";
import HeaderToggles from "@/components/HeaderToggles";
import NotificationBell from "@/components/NotificationBell";
import PageInfoBar from "@/components/PageInfoBar";

// Top bar: transparent over the page. Once the page scrolls it turns into a frosted white strip, so the name and buttons stay readable over anything.
// (Old note: clean and white.) The logo and name sit on the left with some air around them, and the theme, language and
// notification buttons on the right. It always stays pinned at the top while the page scrolls.
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
      <div className={`${home ? "" : "hidden desk:block "}sticky top-0 z-30 bg-white/80 shadow-[0_8px_24px_-14px_rgba(12,11,93,0.45)] backdrop-blur-md`} style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-md px-5 tab:max-w-3xl tab:px-8 desk:max-w-none desk:px-10">
        <div className="flex min-h-12 items-center gap-3 py-1.5 tab:gap-4 pr-1 desk:gap-3 2xl:gap-6">
          <Link href="/" aria-label={`${site.name} home`} className="flex min-w-0 items-center gap-2.5 desk:shrink-0">
            {/* The kicking player alone, in the brand navy, with no tile behind it (public/logo-mark.png) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" aria-hidden className="uf-hdr-logo shrink-0" />
            <span className={`block whitespace-nowrap text-base font-extrabold uppercase leading-tight tracking-wide desk:max-xl:hidden text-brand`}>{site.name}</span>
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
