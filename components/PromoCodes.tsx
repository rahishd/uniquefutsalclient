"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { fmtDay, promosStore } from "@/lib/promos";
import { useSession } from "@/lib/session";

export default function PromoCodes() {
  const session = useSession();
  const [copied, setCopied] = useState<string | null>(null);
  const track = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0); // desktop slider: which code is showing
  const live = (promosStore.use().data ?? []).filter((p) => p.status === "active");

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      // clipboard blocked: nothing to do
    }
  }

  // desktop slider: one code at a time, arrows and dots when there is more than one
  const slide = (by: number) => { const el = track.current; if (el) el.scrollBy({ left: by * el.clientWidth, behavior: "smooth" }); };
  const onSlide = () => { const el = track.current; if (el && el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth)); };

  // promo codes are for signed-in customers; a guest pays the full price
  if (live.length === 0 || session?.registered !== true) return null;

  return (
    <section className="mt-8 desk:mt-10" aria-label="Live promo codes">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live promo codes
        </h2>
        <Link href="/promos" className="flex items-center text-sm text-brand">
          See all <ChevronRight size={16} />
        </Link>
      </div>

      <ul ref={track} onScroll={onSlide} className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2 desk:mx-0 desk:snap-mandatory desk:gap-0 desk:px-0 desk:pb-1 desk:[scrollbar-width:none] desk:[&::-webkit-scrollbar]:hidden">
        {live.map((p) => (
          <li key={p.code} className="glass w-64 shrink-0 snap-start rounded-3xl p-4 desk:w-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{p.description}</p>
              </div>
              <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-accent">{p.discount}</span>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-brand/40 bg-white/50 px-3 py-2">
              <span className="font-mono text-sm font-semibold tracking-wider">{p.code}</span>
              <button
                type="button"
                onClick={() => copy(p.code)}
                aria-label={`Copy code ${p.code}`}
                className="flex items-center gap-1 text-xs font-medium text-brand"
              >
                {copied === p.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{p.until ? `Valid until ${fmtDay(p.until)}` : "No end date"}</p>
          </li>
        ))}
      </ul>
      {live.length > 1 && (
        <div className="mt-2 hidden items-center justify-center gap-3 desk:flex">
          <button type="button" onClick={() => slide(-1)} aria-label="Previous code" className="grid h-7 w-7 place-items-center rounded-full bg-white/70 text-brand shadow-sm"><ChevronLeft size={16} /></button>
          <div className="flex gap-1.5" aria-hidden>{live.map((p, i) => <span key={p.code} className={`h-1.5 rounded-full transition-all ${i === at ? "w-4 bg-brand" : "w-1.5 bg-slate-300"}`} />)}</div>
          <button type="button" onClick={() => slide(1)} aria-label="Next code" className="grid h-7 w-7 place-items-center rounded-full bg-white/70 text-brand shadow-sm"><ChevronRight size={16} /></button>
        </div>
      )}
    </section>
  );
}
