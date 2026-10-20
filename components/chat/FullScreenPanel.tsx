"use client";

import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";

// A full-screen page that opens over the chat: a Back button, a centred title and room to scroll. Escape also goes back.
export default function FullScreenPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind does not scroll
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex flex-col bg-white">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-100 px-3 pb-3 pt-[max(calc(env(safe-area-inset-top)_-_0.625rem),0.5rem)]">
        <button type="button" onClick={onClose} className="flex items-center gap-0.5 justify-self-start rounded-full py-2 pl-1 pr-3 text-sm font-semibold text-brand transition active:bg-slate-100">
          <ChevronLeft size={22} /> Back
        </button>
        <h2 className="text-base font-semibold">{title}</h2>
        <span aria-hidden />
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-5 pb-24 pt-5 tab:max-w-2xl desk:max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
