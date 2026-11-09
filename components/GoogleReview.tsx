"use client";

import { useEffect, useState } from "react";
import { FaGoogle, FaStar } from "react-icons/fa6";
import { Check, Loader2, Star } from "lucide-react";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { claimReviewPoint, reviewStatus } from "@/lib/loyalty";

const PENDING = "uf_review_pending";
const heading = "text-xs font-bold uppercase tracking-[0.2em] text-[#0c0b5d]";

const read = () => { try { return localStorage.getItem(PENDING) === "1"; } catch { return false; } };
const write = (on: boolean) => { try { if (on) localStorage.setItem(PENDING, "1"); else localStorage.removeItem(PENDING); } catch { /* private mode: the offer just is not remembered */ } };

// "How was your experience?": any star (or the link) opens the venue's Google review form.
// A registered customer who has not yet taken it is offered 1 loyalty point: after they come back from Google the page says thank you and
// shows a Claim button. The server gives it once per customer, ever (POST /loyalty/review/claim); guests see none of this.
export default function GoogleReview() {
  const t = useT();
  const session = useSession();
  const registered = !!session && session.registered;
  const [claimed, setClaimed] = useState<boolean | null>(null); // null = not known yet
  const [back, setBack] = useState(false); // has returned from the review page and may claim
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // does this customer still have the point to take?
  useEffect(() => {
    if (!registered) return;
    let on = true;
    reviewStatus().then((s) => { if (on) { setClaimed(s.claimed); if (s.claimed) write(false); else if (read()) setBack(true); } }).catch(() => {});
    return () => { on = false; };
  }, [registered]);

  // coming back to this tab after the review page was opened
  useEffect(() => {
    if (!registered || claimed !== false) return;
    const onBack = () => { if (document.visibilityState === "visible" && read()) setBack(true); };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => { document.removeEventListener("visibilitychange", onBack); window.removeEventListener("focus", onBack); };
  }, [registered, claimed]);

  const opened = () => { if (registered && claimed === false) write(true); };

  async function claim() {
    setBusy(true); setErr("");
    try {
      await claimReviewPoint();
      write(false); setClaimed(true); setBack(false); setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add the point. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Review us on Google" className="mt-10 desk:mt-0 desk:flex desk:flex-col">
      <h2 className={heading}>{t("How was your experience?")}</h2>
      <p className="mt-4 text-sm text-slate-500">{t("Tell others about Unique Futsal with a quick Google review.")}</p>
      <div className="relative mt-3 overflow-hidden rounded-2xl desk:flex desk:flex-1 desk:flex-col desk:justify-center bg-gradient-to-br from-[#eaf3ff] via-[#dbeaff] to-[#cbe0ff] p-3.5 text-center shadow-[0_14px_28px_-16px_rgba(59,130,246,0.5)] ring-1 ring-[#bfd7ff]">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white opacity-70 blur-3xl" />
        <div className="relative flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <a key={n} href={site.googleReview} onClick={opened} target="_blank" rel="noopener noreferrer" aria-label={`Rate us ${n} star${n > 1 ? "s" : ""} on Google`} className="rounded-full p-1 text-[26px] text-[#fbbc05] drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)] transition active:scale-90">
              <FaStar />
            </a>
          ))}
        </div>
        <a href={site.googleReview} onClick={opened} target="_blank" rel="noopener noreferrer" className="relative mt-2 flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold transition active:scale-[0.98]" style={{ color: "#2c3da0" }}>
          <FaGoogle size={13} className="text-[#4285f4]" /> {t("Write a Google review")} <span aria-hidden>→</span>
        </a>
        {!back && (
          <p className="relative mt-2 flex items-center justify-center gap-1 text-[11.5px] font-semibold text-[#2c3da0]">
            <Star size={13} aria-hidden />
            {!registered ? "1 Google review = 1 loyalty point. Sign in to earn it." : claimed ? "1 Google review = 1 loyalty point. You have earned yours, thank you!" : "1 Google review = 1 loyalty point."}
          </p>
        )}
      </div>

      {back && (
        <div role="status" className="mt-3 rounded-2xl bg-white p-4 text-center shadow-md ring-1 ring-[#bfd7ff]">
          <p className="text-sm font-bold text-[#0c0b5d]">Thank you for reviewing Unique Futsal!</p>
          <p className="mt-1 text-xs text-slate-500">Claim your 1 loyalty point for your first review.</p>
          {err && <p className="mt-2 text-xs font-medium text-rose-600">{err}</p>}
          <button type="button" onClick={claim} disabled={busy} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#dbeafe] px-5 py-2 text-sm font-semibold text-[#2c3da0] disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Star size={15} aria-hidden />} Claim 1 loyalty point
          </button>
        </div>
      )}
      {done && (
        <p role="status" className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"><Check size={16} aria-hidden /> 1 loyalty point added to your account. Thank you!</p>
      )}
    </section>
  );
}
