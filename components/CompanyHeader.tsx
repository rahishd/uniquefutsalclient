"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import AdStrip from "@/components/ads/AdStrip";
import DeskNav from "@/components/DeskNav";
import NotificationBell from "@/components/NotificationBell";
import HeaderPoints from "@/components/HeaderPoints";
import HeaderChat from "@/components/HeaderChat";
import HeaderLogout from "@/components/HeaderLogout";
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
  // remember that the visitor has been inside the app in this tab, so the sign-in page can tell a cold start (see AuthForm)
  useEffect(() => { if (!signIn) { try { sessionStorage.setItem("uf-in-app", "1"); } catch { /* private mode */ } } }, [signIn]);
  return (
    <>
      {!home && !signIn && <PageInfoBar />}
      <div className={`hidden desk:block uf-navy-header sticky top-0 z-30 pt-[calc(env(safe-area-inset-top)+1.5rem)] desk:pt-[env(safe-area-inset-top)] shadow-[0_8px_24px_-14px_rgba(12,11,93,0.45)]`}>
      <div className="mx-auto w-full max-w-md px-5 tab:max-w-3xl tab:px-8 desk:max-w-[1320px] desk:px-10">
        <div className="flex min-h-0 items-center gap-3 py-2.5 tab:gap-4 pr-1 desk:gap-3 2xl:gap-6">
          <Link href="/" aria-label={`${site.name} home`} className="flex min-w-0 items-center gap-2.5 desk:shrink-0">
            {/* The kicking player alone, in navy on the white bar, with no tile behind it (public/logo-mark-navy.png) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark-navy.png" alt="" aria-hidden className="uf-hdr-logo shrink-0" style={{ "--s": "28px" } as React.CSSProperties} />
            <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.08em] text-[#0c0b5d]">{site.name}</span>
          </Link>
          <DeskNav />
          <div className="-mr-2 ml-auto flex shrink-0 items-center gap-0 desk:ml-0"><HeaderPoints plain /><HeaderChat /><div className="[&_button[aria-label^=Notifications]]:!h-9 [&_button[aria-label^=Notifications]]:!w-8 [&_button[aria-label^=Notifications]]:!rounded-md [&_button[aria-label^=Notifications]]:!bg-transparent [&_button[aria-label^=Notifications]]:!text-white [&_button[aria-label^=Notifications]]:!shadow-none [&_button[aria-label^=Notifications]]:!ring-0 [&_button[aria-label^=Notifications]]:!border-0 [&_button[aria-label^=Notifications]>svg]:!h-4 [&_button[aria-label^=Notifications]>svg]:!w-4"><NotificationBell /></div><HeaderLogout /></div>
        </div>
        <div className="empty:hidden pb-2"><AdStrip placement="header" /></div>
      </div>
    </div>
    </>
  );
}
