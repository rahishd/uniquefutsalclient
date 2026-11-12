"use client";

import Link from "next/link";
import { ChevronRight, Gift } from "lucide-react";
import PartnerBanners from "./PartnerBanners";
import { partnersStore } from "@/lib/marketplace";

// Home: the partners' banners with their heading, "Partner Rewards". Nothing shows (not even the heading) while no partner has a live banner.
export default function PartnerRewards({ className = "" }: { className?: string }) {
  const any = (partnersStore.use().data ?? []).some((p) => p.bannerUrl);
  if (!any) return null;
  return (
    <section aria-label="Partner Rewards" className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-[#0c0b5d] desk:text-xl">
          <Gift size={16} strokeWidth={2.2} className="text-brand" aria-hidden />
          Partner Rewards
        </h2>
        <Link href="/marketplace" className="flex shrink-0 items-center text-sm text-brand">See all <ChevronRight size={16} /></Link>
      </div>
      <p className="mb-3 truncate text-[12.5px] font-light tracking-wide text-slate-600">Your Refreshments Never End at Unique Futsal</p>
      <PartnerBanners />
    </section>
  );
}
