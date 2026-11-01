"use client";

import HomeSearch from "@/components/HomeSearch";

// The Home search bar, on its own (the weather and date live in the Today card, see components/TodayCard.tsx).
export default function HomeHero() {
  return (
    <section aria-label="Search" className="relative mt-3">
      <HomeSearch />
    </section>
  );
}
