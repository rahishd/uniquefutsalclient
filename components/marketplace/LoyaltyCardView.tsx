"use client";

import { BadgeCheck, Star } from "lucide-react";
import { KIND_LABEL, day, loyaltyCardStore } from "@/lib/marketplace";
import { fmtPts } from "@/lib/points";

// The customer's loyalty card: who they are, what they hold, and the latest points they earned. Every earning came from a bill at Unique Futsal,
// so this is what to show a partner as proof. The server makes it from the real ledger; the app only draws it.
export default function LoyaltyCardView({ compact = false }: { compact?: boolean }) {
  const card = loyaltyCardStore.use().data;
  if (!card) return <div className="h-40 animate-pulse rounded-3xl bg-white/40" aria-label="Loading your loyalty card" />;
  const last = card.phone.length >= 6 ? `${card.phone.slice(0, 2)}****${card.phone.slice(-4)}` : card.phone;
  return (
    <section aria-label="My loyalty card" className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#15167a] to-[#2a2aa8] text-white shadow-lg">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Unique Futsal loyalty card</p><p className="mt-1 truncate text-xl font-semibold">{card.name}</p><p className="text-xs text-white/70">{last} · member since {day(card.memberSince)}</p></div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15"><BadgeCheck size={20} className="text-amber-300" /></span>
        </div>
        <p className="mt-4 text-xs uppercase tracking-wide text-white/60">Points now</p>
        <p className="flex items-center gap-2 text-4xl font-semibold tabular-nums"><Star size={28} className="fill-amber-400 text-amber-400" /> {fmtPts(card.balance)}</p>
      </div>
      {!compact && card.earned.length > 0 && (
        <div className="space-y-1 border-t border-white/15 bg-black/15 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Points earned on my bills</p>
          <ul className="divide-y divide-white/10">
            {card.earned.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{KIND_LABEL[e.kind] ?? "Points"}{e.detail ? `: ${e.detail}` : ""}</span><span className="block text-[11px] text-white/60">{day(e.on)}</span></span>
                <span className="shrink-0 font-semibold tabular-nums text-amber-300">+{fmtPts(e.points)}</span>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-[11px] text-white/60">Show this card at our partners as proof of your points.</p>
        </div>
      )}
    </section>
  );
}
