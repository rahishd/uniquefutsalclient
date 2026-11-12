"use client";

// The signed-in customer's points, shown beside the bell in the top bar. Tapping it opens the Points page.
import Link from "next/link";
import { Star } from "lucide-react";
import { useSession } from "@/lib/session";
import { loyaltyStore } from "@/lib/loyalty";
import { fmtPts } from "@/lib/points";

export default function HeaderPoints({ plain = false }: { plain?: boolean }) {
  const session = useSession();
  const points = loyaltyStore.use().data?.remaining ?? null;
  if (!session?.registered) return null;
  return (
    <Link
      href="/points"
      aria-label={points === null ? "Loyalty points" : `${fmtPts(points)} loyalty points available`}
      className={plain ? "uf-hdr-orange inline-flex items-center gap-1.5 whitespace-nowrap" : "inline-flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-2.5 pr-3 font-extrabold text-[#0c0b5d]"}
    >
      <Star size={plain ? 13 : 15} className={plain ? "fill-white text-white" : "fill-[#f5822a] text-[#f5822a]"} />
      <span className={`${plain ? "text-[13px]" : "text-sm"} leading-none tabular-nums`}>{points === null ? "--" : fmtPts(points)}</span>
      <span className="text-[11px] font-semibold leading-none opacity-80">pts</span>
    </Link>
  );
}
