"use client";

import CharityLine from "@/components/CharityLine";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Clock, Copy, Download, Loader2 } from "lucide-react";
import { METHOD_LABEL, PAYMENT_POLL_MS, fetchPaymentStatus, type OnlineMethod } from "@/lib/payment";

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  method: OnlineMethod;
  orderId: string; // the booking / session ID the server is waiting to see paid
  amount: number; // final amount after every promo code (decided by the server)
  remarks: string; // the short booking code: the customer writes it as the Fonepay remark
  expiresAt: string; // when the held slot runs out
  guestPhone?: string; // a guest has no account: the server checks the order against this number
  onPaid: () => void; // called automatically once the venue confirms the payment
  onBack: () => void;
  backLabel?: string; // default: "Change payment method"
}

// The venue's own Fonepay QR (the same for every customer), the exact amount, and the booking code to write as the remark.
// The venue sees the payment in the Fonepay app and confirms it in the admin portal; this screen watches for that and moves on by itself.
export default function PaymentQr({ method, orderId, amount, remarks, expiresAt, guestPhone, onPaid, onBack, backLabel = "Change payment method" }: Props) {
  const label = METHOD_LABEL[method];
  const reported = useRef(false);
  const onPaidRef = useRef(onPaid); // always call the latest callback without restarting the polling
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  const [serverExpired, setServerExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onPaidRef.current = onPaid;
  });

  useEffect(() => {
    const tick = () => setLeft(new Date(expiresAt).getTime() - Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [expiresAt]);

  const expired = left <= 0 || serverExpired;

  // Ask the server whether the venue has confirmed the payment, every few seconds and whenever the customer
  // comes back to this tab (it may have been paused while they were in their payment app).
  useEffect(() => {
    if (expired) return;
    let cancelled = false;
    const check = async () => {
      if (reported.current) return;
      const status = await fetchPaymentStatus(orderId, guestPhone);
      if (cancelled) return;
      if (status === "paid" && !reported.current) {
        reported.current = true;
        onPaidRef.current();
      } else if (status === "expired") {
        setServerExpired(true); // the server released the slot
      }
    };
    const t = setInterval(check, PAYMENT_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [expired, orderId, guestPhone]);

  async function copyRemarks() {
    try {
      await navigator.clipboard.writeText(remarks);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the code is visible to type in
    }
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-brand">
        <ChevronLeft size={18} /> {backLabel}
      </button>

      <header>
        <h1 className="text-2xl font-semibold">Pay with {label}</h1>
        <p className="text-sm text-slate-500">Scan the venue&apos;s {label} QR, pay the amount below, and write the code as the remark.</p>
      </header>

      <section className="glass rounded-3xl p-5 text-center">
        <p className="text-xs text-slate-400">Amount to pay</p>
        <p className="text-3xl font-semibold">{rs(amount)}</p>
        <div className="mt-1"><CharityLine amount={amount} as="note" /></div>

        {/* the code the customer writes in the Remarks box of their payment app, so the venue can match the payment to this booking */}
        <div className="mt-4 rounded-2xl bg-brand/5 p-4 ring-1 ring-brand/20">
          <p className="text-xs font-medium text-brand">Write this code in Remarks</p>
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="select-all break-all font-mono text-2xl font-bold tracking-wide" aria-label={`Booking code ${remarks}`}>{remarks}</span>
            <button type="button" onClick={copyRemarks} className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand ring-1 ring-brand/20" aria-label="Copy code">
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        </div>

        <div className="mx-auto mt-4 w-fit max-w-full rounded-2xl bg-white p-3 shadow-inner ring-1 ring-slate-100" style={expired ? { opacity: 0.25 } : undefined}>
          {/* the venue's own fixed Fonepay QR (public/fonepay-qr.png): the same picture for every payment */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fonepay-qr.png" alt={`${label} QR of Unique Futsal`} width={669} height={1096} className="h-auto w-full max-w-[260px]" />
        </div>

        <p className={`mt-3 flex items-center justify-center gap-1.5 text-sm font-medium ${expired ? "text-rose-500" : left < 120000 ? "text-orange-500" : "text-slate-500"}`} role="timer" aria-live="off">
          <Clock size={15} /> {expired ? "Your slot is no longer held" : `Your slot is held for ${mmss(left)}`}
        </p>

        {!expired && (
          <a href="/fonepay-qr.png" download="unique-futsal-fonepay-qr.png" className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-5 py-2.5 text-sm font-medium text-brand">
            <Download size={16} /> Save QR image
          </a>
        )}
      </section>

      {/* Live status: the customer just waits; the venue confirms the payment */}
      {!expired && (
        <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl bg-brand/5 px-4 py-3 text-center text-sm font-medium text-brand">
          <Loader2 size={16} className="shrink-0 animate-spin" /> Waiting for the venue to confirm your payment. This page updates by itself.
        </p>
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-medium">How to pay</h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-600">
          {[
            `Open your payment app (${label} or any app that scans QR) and choose Scan QR. Scan the QR above, or tap Save QR image and upload it from your gallery.`,
            `Enter the amount: ${rs(amount)}.`,
            `In Remarks, write ${remarks}. This is how the venue finds your payment.`,
            "Complete the payment. The venue checks it and confirms your booking, usually within a few minutes.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {expired && (
        <>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
            Already paid? Keep your payment screenshot and call the venue with the code {remarks}. They will find your payment.
          </p>
          <button type="button" onClick={onBack} className="glass-btn block w-full rounded-full py-4 text-center text-base font-semibold text-white">
            Start again
          </button>
        </>
      )}
    </div>
  );
}
