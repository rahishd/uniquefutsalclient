"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import { tournamentStore } from "@/lib/tournament";

// Home, phone: while a tournament match is being played, a small card with the live score and a "Watch live" button, between the banner and
// the weather card. It is not there when nothing is live. The score comes from the venue's live updates (refreshed every 30 seconds).
export default function LiveMatchStrip({ className = "" }: { className?: string }) {
  const t = tournamentStore.use().data ?? null;
  const live = t?.rounds.flatMap((r) => r.matches).filter((m) => m.status === "live") ?? [];
  if (!t || live.length === 0) return null;
  const m = live[0];
  const score = (n: number | null) => (n === null ? 0 : n);
  return (
    <section aria-label="Live match" className={`rounded-2xl border border-rose-100 bg-white px-3.5 py-3 shadow-[0_8px_24px_-16px_rgba(225,29,72,0.5)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-600">
          <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" /></span>
          <span className="shrink-0">Live{live.length > 1 ? ` · ${live.length}` : ""}</span>
          <span className="truncate font-medium normal-case tracking-normal text-slate-400">{t.name}</span>
        </p>
        <Link href="/tournaments" className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95">
          <Radio size={13} aria-hidden /> Watch live
        </Link>
      </div>
      <p className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 text-[#0c0b5d]">
        <span className="truncate text-right text-sm font-semibold">{m.home ?? "To be decided"}</span>
        <span className="rounded-lg bg-[#0c0b5d] px-3 py-0.5 text-lg font-extrabold tabular-nums text-white">{score(m.homeScore)} - {score(m.awayScore)}</span>
        <span className="truncate text-sm font-semibold">{m.away ?? "To be decided"}</span>
      </p>
    </section>
  );
}
