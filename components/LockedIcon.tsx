"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Lock, X } from "lucide-react";

// A Home quick icon a guest can see but not use: same look as the real one, with a lock badge. A tap says what signing in gives
// ("Sign in to view your Digital ID") with a Sign in button.
export default function LockedIcon({ label, message, children }: { label: string; message?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const text = message ?? `Sign in to use ${label}.`;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${label} (sign in to use)`} title="Sign in to use" className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm">
        {children}
        <span aria-hidden className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white ring-2 ring-white"><Lock size={9} /></span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-t-3xl bg-[#f4f6fb] p-5 text-center sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end"><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-white/70 p-2"><X size={18} /></button></div>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand"><Lock size={24} /></span>
            <p className="mt-3 text-base font-semibold text-[#0c0b5d]">{text}</p>
            <p className="mt-1 text-xs text-slate-500">This is for registered customers.</p>
            <Link href="/login" className="mt-4 block rounded-full bg-brand py-3 text-sm font-medium text-white">Sign in</Link>
          </div>
        </div>
      )}
    </>
  );
}
