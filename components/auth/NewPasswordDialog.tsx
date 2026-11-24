"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, KeyRound, Loader2, Lock, X } from "lucide-react";
import { errorText } from "@/lib/api";

// "Forgot password", the last step: the code was right, so the customer chooses a NEW password here. The old password is never asked for.
// onSubmit does the change (it throws when the server says no); the dialog shows that message and stays open.
export default function NewPasswordDialog({ onSubmit, onClose }: { onSubmit: (password: string) => Promise<void>; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); };
  }, [busy, onClose]);

  const long = pw.length >= 6;
  const same = pw === pw2;
  const ok = long && same && pw2.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pw);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (!mounted) return null;
  const field = "flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3.5 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-300";
  const input = "w-full bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400";
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Choose a new password" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><KeyRound size={22} aria-hidden /></span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Choose a new password</h2>
              <p className="text-xs text-slate-500">Your number is verified. No need for your old password.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={16} /></button>
        </div>

        <div className={field}>
          <Lock size={18} className="shrink-0 text-slate-400" />
          <input style={{ border: "none" }} className={input} type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (6+ letters)" aria-label="New password" autoComplete="new-password" autoFocus />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="shrink-0 p-1 text-slate-400">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </div>
        <div>
          <div className={`${field} ${pw2.length > 0 && !same ? "!ring-2 !ring-rose-400" : ""}`}>
            <Lock size={18} className="shrink-0 text-slate-400" />
            <input style={{ border: "none" }} className={input} type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" aria-label="Confirm new password" autoComplete="new-password" />
          </div>
          {pw2.length > 0 && !same && <p className="mt-1.5 px-2 text-sm font-medium text-rose-500">The two passwords do not match</p>}
        </div>

        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="submit" disabled={!ok || busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0c0b5d] py-4 text-base font-semibold text-white shadow-[0_12px_24px_-12px_rgba(12,11,93,0.8)] transition active:scale-[0.99] disabled:opacity-40">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : "Save new password"}
        </button>
      </form>
    </div>,
    document.body,
  );
}
