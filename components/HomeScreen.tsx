import Link from "next/link";
import { CalendarDays } from "lucide-react";
import HomeHero from "@/components/HomeHero";
import UserBadge from "@/components/UserBadge";
import LastPlayed from "@/components/LastPlayed";
import TodayCard from "@/components/TodayCard";
import EmergencyReminder from "@/components/emergency/EmergencyReminder";
import HealthReminder from "@/components/health/HealthReminder";
import HomeTop from "@/components/HomeTop";
import DeskHero from "@/components/DeskHero";
import StickyHomeBar from "@/components/StickyHomeBar";
import QuickRebook from "@/components/QuickRebook";
import PopularGrid from "@/components/PopularGrid";
import GoalRushCard from "@/components/goalrush/GoalRushCard";
import PromoCodes from "@/components/PromoCodes";
import BannerOffer from "@/components/BannerOffer";
import TournamentSection from "@/components/TournamentSection";
import KidSkills from "@/components/KidSkills";
import AdCarousel from "@/components/ads/AdCarousel";
import GallerySection from "@/components/ads/GallerySection";
import GiftOffers from "@/components/points/OfferCard";

// Phone and portrait tablet: one column, in the `order-N` order below.
// Tablet and wide phone (`tab:`, 640px and up): the same two columns, 50/50. Desktop mode (`desk:`, see globals.css), top to bottom:
//   row 1  profile card | weather + last played card (half each)
//   row 2  search bar, full width (and the emergency reminder when there is one)
//   row 3  main column (8/12: promo banner, Quick Access, Goal Rush, gallery) | sticky sidebar (4/12: book again, ad, promo codes, tournament)
// The wrappers are `display: contents` on mobile so every block stays in the one column; each block carries its own mobile order.
export default function HomeScreen() {
  return (
    <>
      <StickyHomeBar />
    <div className="uf-home flex flex-col tab:grid tab:grid-cols-12 tab:items-start tab:gap-x-6 desk:items-stretch desk:gap-x-8 desk:gap-y-6">
      <div className="uf-home-left contents tab:col-span-6 tab:block desk:contents">
        {/* phone: white header and account card (components/HomeTop.tsx); desktop: the bar above and the profile card below */}
        <HomeTop />
        {/* desktop only: the venue banner in place of the account and weather cards */}
        <DeskHero />

        {/* desktop profile card: soft blue for a regular customer, dark blue for a VIP (see components/UserBadge.tsx) */}
        <UserBadge />

        <TodayCard />
        <LastPlayed />

        {/* no emergency contact on the account yet (older or Google accounts): a reminder with a link to add it */}
        <EmergencyReminder className="order-1 mx-3 mt-3 desk:order-2 desk:col-span-12 desk:mx-0 desk:mt-0" />
        <HealthReminder className="order-1 mx-0 mt-2.5 desk:order-2 desk:col-span-12 desk:mt-0" />

        {/* the search bar: on its own, full width on desktop */}
        <div className="order-2 tab:mt-3 tab:[&>*]:mt-0 desk:order-1 desk:col-span-8 desk:self-center desk:mt-0 desk:[&>*]:mt-0"><HomeHero /></div>

        {/* the offers and ads, right under the search bar: swipe left or right (components/ads/AdCarousel.tsx) */}
        <div className="order-2 mt-3 empty:hidden desk:col-span-12 desk:mx-auto desk:w-full desk:max-w-4xl"><AdCarousel /></div>

        {/* points the venue offered: right under the search bar until the customer adds them */}
        <GiftOffers className="order-[3] mt-4 empty:hidden desk:col-span-12 desk:mt-0" />

        <div className="uf-home-main contents desk:order-[5] desk:col-span-8 desk:block">
        {/* Promo banner */}
        <section className="relative order-5 mt-5 min-h-[230px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)] desk:mt-0 desk:min-h-[300px] desk:p-10">
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
          {/* photos from games and tournaments: only shows once photos are uploaded (components/ads/GallerySection.tsx) */}
          <GallerySection />
          {/* the penalty mini game, right under Quick Access */}
          <GoalRushCard />
        </div>
        </div>
      </div>

      <aside className="uf-home-side contents tab:col-span-6 tab:flex tab:flex-col tab:gap-4 desk:sticky desk:top-28 desk:order-[6] desk:col-span-4 desk:gap-5 desk:self-start">
        <div className="order-[6] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><QuickRebook /></div>
        <div className="order-[9] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><PromoCodes /></div>
        <div className="order-[10] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><TournamentSection /></div>
      </aside>

    </div>
    </>
  );
}
