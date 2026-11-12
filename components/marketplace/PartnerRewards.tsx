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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-[#0c0b5d] desk:text-xl">
          <Gift size={16} strokeWidth={2.2} className="text-brand" aria-hidden />
          Partner Rewards
        </h2>
        <Link href="/marketplace" className="flex items-center text-sm text-brand">See all <ChevronRight size={16} /></Link>
      </div>
      <PartnerBanners />
    </section>
  );
}
