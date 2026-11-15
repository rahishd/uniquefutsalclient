"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareLock, RotateCw, X } from "lucide-react";

// A one-time-code (OTP) dialog. Six boxes over ONE real input, so typing, pasting, backspace and the phone's own "code from SMS" suggestion all work.
// What it does on screen:
//   - the dialog rises in with a soft spring; the box waiting for the next digit glows and shows a blinking caret;
//   - every digit pops into its box;
//   - when the last digit is in, the code is checked by itself: the boxes ripple while it is checked;
//   - right: the boxes turn green one after another and a check mark draws itself, then onVerified runs;
//   - wrong: the boxes flash red and shake, are cleared, and the first box is ready again;
//   - "Resend code" counts down in a small ring, then can be pressed.
// Nothing here knows how the code is checked: the page gives onVerify(code), which answers { ok: true } or { ok: false, message }.
// All motion stops when the device has "reduce motion" on. The animations are in app/globals.css (uf-otp-*).

export type OtpResult = { ok: true } | { ok: false; message?: string };
type Phase = "idle" | "checking" | "ok" | "bad";

export interface OtpDialogProps {
  /** where the code was sent, shown hidden in the middle, for example "98••••1234" */
  sentTo: string;
  onVerify: (code: string) => Promise<OtpResult>;
  /** asks the server for a new code; the dialog restarts its countdown */
  onResend?: () => Promise<void> | void;
  /** called a moment after the check mark, when the code was right */
  onVerified: () => void;
  onClose: () => void;
  length?: number;
  resendSeconds?: number;
  title?: string;
}

const NAVY = "#0c0b5d";
const BLUE = "#3345b0";

function Ring({ left, total }: { left: number; total: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="-rotate-90">
      <circle cx="11" cy="11" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
      <circle cx="11" cy="11" r={r} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

export default function OtpDialog({ sentTo, onVerify, onResend, onVerified, onClose, length = 6, resendSeconds = 30, title = "Verify your number" }: OtpDialogProps) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [left, setLeft] = useState(resendSeconds);
  const [resending, setResending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = phase === "checking" || phase === "ok";

  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);
  useEffect(() => { if (mounted) input.current?.focus(); }, [mounted]);

  // the resend countdown
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  // the page behind does not scroll while the dialog is open; Escape closes it
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); };
  }, [busy, onClose]);

  const check = useCallback(async (code: string) => {
    setPhase("checking");
    setMessage("");
    try {
      const r = await onVerify(code);
      if (r.ok) {
        setPhase("ok");
        setTimeout(onVerified, 1300); // let the boxes turn green and the check mark draw first
      } else {
        setPhase("bad");
        setMessage(r.message ?? "That code is not right. Please try again.");
        setTimeout(() => { setValue(""); setPhase("idle"); input.current?.focus(); }, 650);
      }
    } catch {
      setPhase("bad");
      setMessage("Could not check the code. Check your connection and try again.");
      setTimeout(() => { setValue(""); setPhase("idle"); input.current?.focus(); }, 650);
    }
  }, [onVerify, onVerified]);

  function change(raw: string) {
    if (busy) return;
    const digits = raw.replace(/\D/g, "").slice(0, length);
    setValue(digits);
    if (phase === "bad") setPhase("idle");
    if (message) setMessage("");
    if (digits.length === length) void check(digits);
  }

  async function resend() {
    if (left > 0 || resending || busy) return;
    setResending(true);
    try { await onResend?.(); setLeft(resendSeconds); setValue(""); setMessage(""); setPhase("idle"); input.current?.focus(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not send a new code. Please try again."); }
    finally { setResending(false); }
  }

  const active = Math.min(value.length, length - 1);
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  const box = (i: number) => {
    const ch = value[i];
    const isActive = phase === "idle" && i === active;
    let border = "#cbd5e1", bg = "#ffffff", color = NAVY, anim = "";
    if (ch) border = NAVY;
    if (phase === "checking") { border = BLUE; anim = `uf-otp-wave 0.9s ease-in-out ${i * 0.08}s infinite`; }
    if (phase === "ok") { border = "#10b981"; bg = "#ecfdf5"; color = "#047857"; anim = `uf-otp-ok 0.5s cubic-bezier(.2,1.4,.4,1) ${i * 0.07}s both`; }
    if (phase === "bad") { border = "#f43f5e"; bg = "#fff1f2"; color = "#be123c"; }
    return (
      <span key={i} aria-hidden className="relative grid h-14 w-11 place-items-center rounded-xl border-2 text-2xl font-bold tabular-nums transition-colors duration-200 sm:h-16 sm:w-12"
        style={{ borderColor: isActive ? BLUE : border, background: bg, color, animation: anim || (isActive ? "uf-otp-glow 1.6s ease-out infinite" : undefined), boxShadow: ch && phase === "idle" ? "0 6px 14px -8px rgba(12,11,93,0.5)" : undefined }}>
        {ch ? <span key={ch + i} style={{ display: "inline-block", animation: phase === "idle" ? "uf-otp-pop 0.28s cubic-bezier(.2,1.5,.4,1)" : undefined }}>{ch}</span> : isActive && !busy ? <span className="h-6 w-0.5 rounded-full" style={{ background: BLUE, animation: "uf-otp-caret 1s steps(1) infinite" }} /> : null}
      </span>
    );
  };

  if (!mounted) return null; // the dialog is made in the browser only (it is drawn over the page)
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0" style={{ background: "rgba(8,10,40,0.55)", animation: "uf-otp-fade 0.25s ease-out" }} onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="otp-title" aria-describedby="otp-sub" onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white px-6 pb-6 pt-8 text-center shadow-[0_30px_70px_-20px_rgba(12,11,93,0.6)]" style={{ animation: "uf-otp-in 0.5s cubic-bezier(.2,1,.3,1)" }}>
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full" style={{ background: "rgba(51,69,176,0.08)" }} />
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-30"><X size={18} /></button>

        {/* the badge: a lock-message icon that turns into a drawn check mark when the code is right */}
        <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full transition-colors duration-500" style={{ background: phase === "ok" ? "#d1fae5" : "#e8edff", color: phase === "ok" ? "#059669" : BLUE }}>
          {phase === "ok" ? (
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
              <circle cx="17" cy="17" r="15" stroke="#10b981" strokeWidth="2.5" strokeDasharray="95" strokeDashoffset="95" style={{ animation: "uf-otp-draw 0.55s ease-out forwards" }} />
              <path d="M10 17.5l5 5 9-10" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="26" strokeDashoffset="26" style={{ animation: "uf-otp-draw 0.45s ease-out 0.4s forwards" }} />
            </svg>
          ) : <MessageSquareLock size={28} style={{ animation: "uf-otp-float 3s ease-in-out infinite" }} />}
        </div>

        <h2 id="otp-title" className="mt-4 text-xl font-bold" style={{ color: NAVY }}>{phase === "ok" ? "Verified" : title}</h2>
        <p id="otp-sub" className="mt-1 text-sm text-slate-500">{phase === "ok" ? "Your number is confirmed." : <>Enter the {length}-digit code we sent to <span className="font-semibold text-slate-700">{sentTo}</span></>}</p>

        <div className="relative mx-auto mt-6 w-fit" style={{ animation: phase === "bad" ? "uf-otp-shake 0.5s cubic-bezier(.36,.07,.19,.97)" : undefined }}>
          <div className="flex justify-center gap-2 sm:gap-2.5" onClick={() => input.current?.focus()}>{Array.from({ length }, (_, i) => box(i))}</div>
          <input ref={input} value={value} onChange={(e) => change(e.target.value)} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={length} disabled={busy} aria-label={`${length} digit code`}
            className="absolute inset-0 h-full w-full cursor-text opacity-0" />
        </div>

        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm font-medium" style={{ color: phase === "bad" || message ? "#e11d48" : "#64748b" }}>
          {phase === "checking" ? "Checking…" : message}
        </p>

        <div className="mt-2 flex items-center justify-center gap-2 text-sm">
          {left > 0 ? (
            <span className="flex items-center gap-2 text-slate-500"><Ring left={left} total={resendSeconds} /> Resend code in <span className="font-semibold tabular-nums text-slate-700">{mm}</span></span>
          ) : (
            <button type="button" onClick={resend} disabled={resending || busy} className="flex items-center gap-1.5 rounded-full px-4 py-2 font-semibold disabled:opacity-50" style={{ color: BLUE, background: "#e8edff", animation: "uf-otp-in 0.35s ease-out" }}><RotateCw size={14} className={resending ? "animate-spin" : ""} /> Resend code</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
