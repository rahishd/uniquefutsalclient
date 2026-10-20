import Link from "next/link";
import { CalendarDays } from "lucide-react";
import HomeHero from "@/components/HomeHero";
import UserBadge from "@/components/UserBadge";
import LastPlayed from "@/components/LastPlayed";
import EmergencyReminder from "@/components/emergency/EmergencyReminder";
import HeaderPoints from "@/components/HeaderPoints";
import NotificationBell from "@/components/NotificationBell";
import StickyHomeBar from "@/components/StickyHomeBar";
import { site } from "@/lib/site";
import QuickRebook from "@/components/QuickRebook";
import PopularGrid from "@/components/PopularGrid";
import GoalRushCard from "@/components/goalrush/GoalRushCard";
import PromoCodes from "@/components/PromoCodes";
import BannerOffer from "@/components/BannerOffer";
import TournamentSection from "@/components/TournamentSection";
import KidSkills from "@/components/KidSkills";
import AdStrip from "@/components/ads/AdStrip";
import GallerySection from "@/components/ads/GallerySection";
import ScrollBackdrop from "@/components/ScrollBackdrop";

// Phone and portrait tablet: one column, in the `order-N` order below.
// Tablet and wide phone (`tab:`, 640px and up): the same two columns, 50/50. Desktop mode (`desk:`, see globals.css): main content on the left, a sticky sidebar on the right (the light blue hero card with
// weather, date, search and shortcuts, book again, ad, promo codes, tournament). The two wrappers are `display: contents` on mobile so every block stays in
// the one column; each block carries its own mobile order.
export default function HomeScreen() {
  return (
    <>
      <StickyHomeBar />
    <div className="flex flex-col tab:grid tab:grid-cols-12 tab:items-start tab:gap-x-6 desk:gap-x-10">
      {/* photo background that changes as the page scrolls (fixed, behind everything, ignores clicks) */}
      <ScrollBackdrop />
      <div className="contents tab:col-span-6 tab:block desk:col-span-8">
        {/* Who is signed in. The bell lives in the page header (components/CompanyHeader.tsx). */}
        <header className="uf-navy-card order-1 -mx-5 -mt-5 overflow-hidden rounded-b-[2rem] bg-[#0c0b5d] tab:mx-0 tab:mt-0 tab:rounded-3xl text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
          {/* phone: the logo, points and bell sit on the top row of this one card (on desktop the bar above does this) */}
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),2.75rem)+0.5rem)] desk:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/logo-mark-white.png" alt="" aria-hidden className="h-9 w-auto shrink-0" />
              <span className="whitespace-nowrap text-sm font-extrabold uppercase tracking-wide">{site.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <HeaderPoints />
              <NotificationBell />
            </div>
          </div>
</header>

        {/* the captain card: its own grey box under the header */}
        <div className="order-1 mt-3 flex items-center justify-between rounded-3xl bg-white p-3 text-[#0c0b5d] shadow-[0_10px_24px_-14px_rgba(15,23,42,0.5)] desk:mx-0 desk:mt-4 desk:p-4">
          <UserBadge />
        </div>

        <LastPlayed />

        {/* no emergency contact on the account yet (older or Google accounts): a reminder with a link to add it */}
        <EmergencyReminder className="order-1 mx-3 mt-3 desk:mx-0" />

        {/* Promo banner */}
        <section className="relative order-5 mt-5 min-h-[230px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)] desk:mt-6 desk:min-h-[300px] desk:p-10">
          <div className="relative z-10 max-w-[56%] desk:max-w-[52%]">
            <BannerOffer />
            <h2 className="mt-1 text-xl font-medium leading-snug desk:mt-2 desk:text-4xl desk:leading-tight">Exclusive deals on your next game</h2>
            <Link href="/book" className="glass-btn mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white desk:mt-7 desk:px-7 desk:py-3.5 desk:text-base">
              <CalendarDays size={16} /> Book now
            </Link>
          </div>
          <KidSkills className="pointer-events-none absolute bottom-0 right-0 h-[230px] w-auto desk:right-10 desk:h-[300px]" />
        </section>

        <div className="order-[7]">
          <PopularGrid />
          {/* the penalty mini game, right under Quick Access */}
          <GoalRushCard />
        </div>
        <div className="order-[11]"><GallerySection /></div>
      </div>

      <aside className="contents tab:col-span-6 tab:flex tab:flex-col tab:gap-4 desk:sticky desk:top-28 desk:col-span-4 desk:gap-5">
        <div className="order-2 tab:[&>*]:mt-0 desk:[&>*]:mt-0"><HomeHero /></div>
        <div className="order-[6] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><QuickRebook /></div>
        <div className="order-[8] mt-5 empty:hidden tab:mt-0 desk:mt-0"><AdStrip placement="inline" /></div>
        <div className="order-[9] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><PromoCodes /></div>
        <div className="order-[10] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><TournamentSection /></div>
      </aside>

    </div>
    </>
  );
}
