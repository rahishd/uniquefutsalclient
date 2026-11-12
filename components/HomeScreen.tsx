import Link from "next/link";
import { CalendarDays } from "lucide-react";
import HomeHero from "@/components/HomeHero";
import UserBadge from "@/components/UserBadge";
import LastPlayed from "@/components/LastPlayed";
import EmergencyReminder from "@/components/emergency/EmergencyReminder";
import HealthReminder from "@/components/health/HealthReminder";
import HomeTop, { DeskGreeting } from "@/components/HomeTop";
import DeskHero from "@/components/DeskHero";
import DeskMembersOnly from "@/components/DeskMembersOnly";
import GuestPrompt from "@/components/GuestPrompt";
import StickyHomeBar from "@/components/StickyHomeBar";
import QuickRebook from "@/components/QuickRebook";
import PopularGrid from "@/components/PopularGrid";
import PartnerRewards from "@/components/marketplace/PartnerRewards";
import WhyUnique from "@/components/WhyUnique";
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
        <DeskHero><DeskGreeting className="text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.7)]" /></DeskHero>

        {/* Quick Access (and the partner offers) in one full-width row. Desktop: right under the venue banner, and only for signed-in customers.
            Phone: where it always was, after the offers (order-[7]). */}
        <DeskMembersOnly className="uf-home-quick order-[7] desk:order-1 desk:col-span-12 desk:[&>section]:mt-0">
          <PopularGrid />
        </DeskMembersOnly>
        {/* desktop, right under Quick Access, in one row: the deals banner on the left (8 of 12), the live promo codes on the right (4 of 12). The weather, the
            search bar and the Nepali date are on the hero picture (components/DeskHero.tsx). The phone and tablet keep their own places: the weather in the account
            card, the search bar under it, the banner further down, the promo codes in the side column. With no promo code the banner takes the whole row. */}
        <div className="uf-home-main contents desk:order-1 desk:col-span-8 desk:block">
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
        </div>
        <div className="uf-desk-top contents">
          <div className="uf-desk-left contents desk:hidden">
            <div className="uf-desk-search order-2 tab:mt-3 tab:[&>*]:mt-0"><HomeHero /></div>
          </div>
          <div className="uf-promo-col hidden empty:hidden desk:relative desk:order-1 desk:col-span-4 desk:block desk:[&>*]:mt-0"><PromoCodes /></div>
        </div>
        {/* the partner offers (spend loyalty points for a discount), the same banners as on the Loyalty points page; nothing shows without a live partner.
            Desktop: under the weather, search and promo codes, for signed-in customers. Phone: right after Quick Access, as before. */}
        <DeskMembersOnly className="uf-desk-partner order-[7] mt-6 empty:hidden desk:order-1 desk:col-span-6 desk:mt-0 desk:self-start"><PartnerRewards /></DeskMembersOnly>
        {/* the offers and ads (swipe left or right, components/ads/AdCarousel.tsx). Desktop: in the same row as the partner offers, half each; alone (guests, or no
            partner offer) it takes the whole row. */}
        <div className="uf-desk-foryou order-2 mt-3 empty:hidden desk:order-1 desk:col-span-6 desk:mt-0 desk:self-start"><AdCarousel /></div>
        <GuestPrompt className="order-1 hidden desk:col-span-12 desk:block" />

        {/* desktop profile card: soft blue for a regular customer, dark blue for a VIP (see components/UserBadge.tsx) */}
        <UserBadge />

        <LastPlayed />

        {/* no emergency contact on the account yet (older or Google accounts): a reminder with a link to add it */}
        <EmergencyReminder className="order-1 mx-3 mt-3 desk:order-2 desk:col-span-12 desk:mx-0 desk:mt-0" />
        <HealthReminder className="order-1 mx-0 mt-2.5 desk:order-2 desk:col-span-12 desk:mt-0" />

        {/* points the venue offered: right under the search bar until the customer adds them */}
        <GiftOffers className="order-[3] mt-4 empty:hidden desk:col-span-12 desk:mt-0" />


        {/* photos from games and tournaments: only shows once photos are uploaded (components/ads/GallerySection.tsx); desktop: full width, corner to corner */}
        <div className="order-[7] empty:hidden desk:order-[10] desk:col-span-12 desk:mt-10"><GallerySection /></div>

        <div className="uf-home-below order-[7] desk:order-[8] desk:col-span-8 desk:flex desk:flex-col">
          {/* the penalty mini game, right under Quick Access */}
          <GoalRushCard />
        </div>
      </div>

      <aside className="uf-home-side contents tab:col-span-6 tab:flex tab:flex-col tab:gap-4 desk:order-[9] desk:col-span-4 desk:flex desk:flex-col desk:gap-5">
        {/* phone and tablet only: on the desktop "Book again" sits on the hero picture (components/DeskHero.tsx) */}
        <div className="order-[6] empty:hidden tab:[&>*]:mt-0 desk:hidden"><QuickRebook /></div>
        <div className="order-[9] empty:hidden tab:[&>*]:mt-0 desk:hidden"><PromoCodes /></div>
        <div className="uf-rest-col order-[10] empty:hidden tab:[&>*]:mt-0 desk:[&>*]:mt-0"><TournamentSection /></div>
        {/* desktop: beside the Goal Rush card; `uf-rest-col` keeps the side column open (see the :has() rule in globals.css) */}
        <div className="uf-rest-col uf-desk-only order-[11] hidden desk:flex desk:flex-1 desk:flex-col"><WhyUnique className="flex flex-1 flex-col" /></div>
      </aside>

    </div>
    </>
  );
}
