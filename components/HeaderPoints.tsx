"use client";

// The signed-in customer's points, shown beside the bell in the top bar. Tapping it opens the Points page.
import Link from "next/link";
import { Star } from "lucide-react";
import { useSession } from "@/lib/session";
import { loyaltyStore } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";

export default function HeaderPoints() {
  const session = useSession();
  const points = loyaltyStore.use().data?.remaining ?? null;
  if (!session?.registered) return null;
  return (
    <Link
      href="/points"
      aria-label={points === null ? "Loyalty points" : `${fmtPts(points)} loyalty points available`}
      className="inline-flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-2.5 pr-3 font-extrabold text-[#0c0b5d] shadow-md ring-2 ring-white/30"
    >
      <Star size={15} className="fill-[#f5822a] text-[#f5822a]" />
      <span className="text-sm leading-none tabular-nums">{points === null ? "--" : fmtPts(points)}</span>
      <span className="text-[11px] font-bold leading-none">pts</span>
    </Link>
  );
}
