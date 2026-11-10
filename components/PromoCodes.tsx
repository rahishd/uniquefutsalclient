"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Info, X } from "lucide-react";
import { fmtDay, promosStore, type Promo } from "@/lib/promos";
import { useSession } from "@/lib/session";

// every offer card is mid-dark blue with a thin orange edge, white text and a light red discount amount
const NAVY = { bg: "#2c3da0", ink: "#ffffff", dark: "#2c3da0", red: "#ff9aa0" };

const hour12 = (t: string) => {
  const h = parseInt(t, 10);
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
};

// the limits staff set on a code, as short tags: first N customers (and how many are left), uses each, slot hours, weekdays
function limitTags(p: Promo): string[] {
  const tags: string[] = [];
  if (p.maxUses) tags.push(`First ${p.maxUses} customers${p.usesLeft != null ? ` · ${p.usesLeft} left` : ""}`);
  if (p.maxPerCustomer) tags.push(p.maxPerCustomer === 1 ? "1 use each" : `${p.maxPerCustomer} uses each`);
  if (p.slotFrom && p.slotTo) tags.push(`Slots ${hour12(p.slotFrom)} – ${hour12(p.slotTo)}`);
  if (p.validDays?.length) tags.push(p.validDays.map((d) => d.slice(0, 3)).join(", "));
  return tags;
}

// The card shows only the discount, the title, the last valid day and the code. "Details" opens a pop-up at once with everything else.
export function PromoCard({ p, copied, onCopy }: { p: Promo; copied: boolean; onCopy: () => void }) {
  const pal = NAVY;
  const off = /^(.*?)\s*OFF$/i.exec(p.discount);
  const [open, setOpen] = useState(false);
  const valid = p.until ? "Valid until " + fmtDay(p.until) : "No end date";
  const amount = off ? off[1] : p.discount;
  return (
    <li className="w-72 shrink-0 snap-start !border-0 !bg-transparent !p-0 !shadow-none desk:w-full">
      <div className="rounded-3xl p-3.5 shadow-[0_10px_22px_-14px_rgba(12,11,93,0.55)]" style={{ background: pal.bg, color: pal.ink, border: "1px solid #f5822a" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-bold leading-snug">{p.title}</p>
          <button type="button" onClick={() => setOpen(true)} aria-label={"Details of " + p.title} className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "transparent", borderColor: pal.ink, color: pal.ink }}>
            <Info size={12} aria-hidden /> Details
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1 whitespace-nowrap" style={{ color: pal.red }}>
            <span className="text-2xl font-extrabold leading-none tabular-nums">{amount}</span>
            {off && <span className="text-[11px] font-bold uppercase tracking-wider">off</span>}
          </p>
          <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[10px] font-semibold" style={{ color: pal.ink }}>
            <CalendarDays size={11} aria-hidden className="shrink-0" /> {valid}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border-2 border-dashed px-3 py-2" style={{ borderColor: pal.ink, color: pal.ink }}>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase leading-none tracking-[0.18em]">Promo code</span>
            <span className="mt-1 block truncate font-mono text-base font-extrabold leading-none tracking-wider">{p.code}</span>
          </div>
          <button type="button" onClick={onCopy} aria-label={"Copy code " + p.code} className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: pal.ink, color: pal.dark }}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </div>
      {open && <PromoDetails p={p} pal={pal} amount={amount} valid={valid} copied={copied} onCopy={onCopy} onClose={() => setOpen(false)} />}
    </li>
  );
}

// The pop-up: the whole offer in one place, nothing more to open. Closes on the backdrop, the X or Escape.
function PromoDetails({ p, pal, amount, valid, copied, onCopy, onClose }: { p: Promo; pal: { bg: string; ink: string; dark: string; red: string }; amount: string; valid: string; copied: boolean; onCopy: () => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const tags = limitTags(p);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={"Details of " + p.title} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white text-[#14142b] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative p-4" style={{ background: pal.bg, color: pal.ink }}>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: pal.ink }}><X size={15} /></button>
          <div className="inline-block rounded-xl px-2.5 py-1 text-lg font-extrabold leading-none text-white" style={{ background: "#ee5a60" }}>{amount}{/off$/i.test(p.discount) && <span className="ml-1 text-[10px] font-bold uppercase tracking-wider">off</span>}</div>
          <p className="mt-2 pr-8 text-base font-bold leading-snug">{p.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: pal.ink }}><CalendarDays size={11} aria-hidden /> {valid}</p>
        </div>
        <div className="space-y-3 p-4 text-sm">
          {p.description && <p className="leading-snug text-slate-700">{p.description}</p>}
          {tags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Who and when</p>
              <div role="list" className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((t) => <span role="listitem" key={t} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#e8ecfb", color: pal.dark }}>{t}</span>)}
              </div>
            </div>
          )}
          {p.terms && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Terms</p>
              <p className="mt-1 text-xs leading-snug text-slate-600">{p.terms}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed px-3 py-2" style={{ borderColor: pal.dark, color: pal.dark }}>
            <span className="truncate font-mono text-base font-extrabold tracking-wider">{p.code}</span>
            <button type="button" onClick={onCopy} aria-label={"Copy code " + p.code} className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: pal.dark }}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
        {live.map((p) => <PromoCard key={p.code} p={p} copied={copied === p.code} onCopy={() => copy(p.code)} />)}
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
