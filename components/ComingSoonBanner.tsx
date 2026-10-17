"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { useT } from "@/lib/i18n";

// A banner for what is coming next (Unique Cricket, indoor cricket pitch). Two looks: "card" (Home, a light-blue card like
// the weather card, between the greeting and the weather) and "tile" (a small square with a "Soon" ribbon, in the slim top
// bar on other pages). Tapping either opens a card that says the features are coming soon. Picture: public/unique-cricket.jpg.
export const DESIGNER = "Rahish Dumre";

export default function ComingSoonBanner({ size = 44, variant = "tile" }: { size?: number; variant?: "tile" | "card" }) {
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Unique Cricket: coming soon")}
          aria-haspopup="dialog"
          className="relative mt-5 flex w-full items-center gap-4 overflow-hidden rounded-[28px] border border-[#bfd7ff] p-4 text-left shadow-[0_8px_24px_rgba(59,130,246,0.16)] transition active:scale-[0.99]"
          style={{ background: "linear-gradient(135deg, #eaf3ff 0%, #d6e7ff 55%, #c3dcff 100%)" }}
        >
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white opacity-50 blur-2xl" />
          <span aria-hidden className="relative h-[72px] w-[72px] shrink-0 rounded-2xl bg-[#0c0b5d] bg-cover bg-center shadow-md ring-2 ring-white" style={{ backgroundImage: "url(/unique-cricket.jpg)" }} />
          <span className="relative min-w-0 flex-1">
            <span className="uf-soon flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow ring-1 ring-white">
              <Sparkles size={11} aria-hidden /> {t("Coming soon")}
            </span>
            <span className="mt-1.5 block text-base font-semibold leading-tight text-[#0c0b5d]">Unique Cricket</span>
            <span className="block text-xs text-[#1e3a8a]/80">{t("Indoor cricket pitch")}</span>
          </span>
          <ChevronRight size={20} className="relative shrink-0 text-[#0c0b5d]/60" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Unique Cricket: coming soon")}
          aria-haspopup="dialog"
          className="relative shrink-0 rounded-xl bg-[#0c0b5d] bg-cover bg-center shadow-md ring-2 ring-white transition active:scale-95"
          style={{ width: size, height: size, backgroundImage: "url(/unique-cricket.jpg)" }}
        >
          {/* the ribbon: gold, tilted a little, pulsing softly (still when the phone asks for less motion) */}
          <span
            aria-hidden
            className="uf-soon absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-px text-[8px] font-extrabold uppercase leading-tight tracking-wider text-white shadow ring-1 ring-white"
          >
            {t("Soon")}
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-5" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t("Features Coming Soon")} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs overflow-hidden rounded-3xl bg-[#0b1220] text-center shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label={t("Close")} className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white"><X size={18} /></button>
            <div className="aspect-square w-full bg-cover bg-center" style={{ backgroundImage: "url(/unique-cricket.jpg)" }} role="img" aria-label="Unique Cricket, indoor cricket pitch" />
            <div className="space-y-2 px-6 pb-6 pt-4">
              <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white">
                <Sparkles size={13} aria-hidden /> {t("Coming soon")}
              </p>
              <h2 className="text-xl font-bold text-white">{t("Features Coming Soon")}</h2>
              <p className="text-xs text-slate-400">{t("Designed & Developed by")}: <span className="font-semibold text-slate-200">{DESIGNER}</span></p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
