"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Loader2, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { enablePush, pushState, pushSupported } from "@/lib/push";

// One-tap "Turn on alerts". Alerts (booking confirmed, 1-hour reminder, offers) reach the phone even when the app and the browser are closed
// (Web Push, see lib/push.ts). The browser asks "Allow notifications?" only after the customer taps the button here, which is the only
// moment it is allowed to ask well. Shown to signed-in customers whose device has not allowed alerts yet:
//   Android / desktop browsers: right away (after the install pop-up is gone).
//   iPhone: only inside the app added to the Home Screen (iOS Safari does not allow push for a plain web page).
// "Not now" hides it for 3 days. It never shows when the browser has blocked notifications (the customer decided) or the device cannot do push.

const SNOOZE_KEY = "uf-alerts-snooze-until";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 9000; // after the install pop-up (3 s, or 10 s when it shows the browser-menu steps) has had its turn

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function snoozed() {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
}

export default function AlertsPrompt() {
  const session = useSession();
  const signedIn = session?.registered === true;
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<"ask" | "working" | "done">("ask");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn || !pushSupported() || snoozed()) return;
    if (isIos() && !isStandalone()) return; // the install pop-up comes first; push only works from the Home Screen app
    let alive = true;
    const t = setTimeout(async () => {
      try {
        if ((await pushState()) !== "off" || Notification.permission !== "default") return; // already on, or blocked by the customer
        // never on top of the install pop-up
        if (document.querySelector('[role="dialog"][aria-label="Install Unique Futsal"]')) return;
        if (alive) setShow(true);
      } catch { /* not available: stay hidden */ }
    }, SHOW_DELAY_MS);
    return () => { alive = false; clearTimeout(t); };
  }, [signedIn]);

  function later() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked */ }
    setShow(false);
  }

  async function turnOn() {
    if (phase === "working") return;
    setPhase("working");
    setError("");
    try {
      const r = await enablePush();
      if (r.ok) {
        setPhase("done");
        setTimeout(() => setShow(false), 2200);
      } else {
        setPhase("ask");
        setError(r.error);
      }
    } catch {
      setPhase("ask");
      setError("Could not turn alerts on. Please try again.");
    }
  }

  if (!show) return null;
  return (
    <div role="dialog" aria-label="Turn on alerts" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[60] px-4 desk:inset-x-auto desk:bottom-6 desk:left-6 desk:w-[24rem] desk:px-0">
      <div className="relative mx-auto max-w-xs rounded-2xl border border-slate-300 bg-white p-3.5 shadow-lg">
        {phase !== "done" && (
          <button type="button" onClick={later} aria-label="Not now" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={14} /></button>
        )}
        {phase === "done" ? (
          <p role="status" className="flex items-center gap-2 py-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={20} /> Alerts are on. We will tell you about your games.</p>
        ) : (
          <>
            <div className="flex items-center gap-2.5 pr-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm"><BellRing size={20} /></span>
              <div>
                <p className="text-sm font-semibold leading-tight">Get alerts, even when the app is closed</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Booking confirmed, your 1-hour game reminder and offers, straight to your phone.</p>
              </div>
            </div>
            {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={later} className="flex-1 rounded-full bg-slate-100 py-2 text-xs font-medium text-slate-600">Not now</button>
              <button type="button" onClick={turnOn} disabled={phase === "working"} className="glass-btn flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold disabled:opacity-60">
                {phase === "working" ? <><Loader2 size={14} className="animate-spin" /> Please wait…</> : <><BellRing size={14} /> Turn on alerts</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
