"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { enablePush, pushState, type PushState } from "@/lib/push";

// Message alerts reach a phone only after the person allows notifications on that device. Shown on the chat list until they do.
// iPhone needs the app added to the Home Screen first; blocked notifications can only be turned back on in the browser's settings.
export default function ChatAlertsBanner() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    pushState().then((s) => live && setState(s)).catch(() => live && setState("unsupported"));
    return () => { live = false; };
  }, []);

  if (state === null || state === "on") return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    const r = await enablePush();
    if (r.ok) setState("on");
    else setError(r.error);
    setBusy(false);
  }

  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <section aria-label="Message alerts" className="glass flex items-start gap-3 rounded-3xl p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-brand"><BellRing size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Get alerts for new messages</p>
        {state === "unsupported" ? (
          <p className="mt-0.5 text-xs text-slate-500">
            {ios ? "On iPhone, add the app to your Home Screen first (Share, then Add to Home Screen), then open it from there." : "This browser cannot show alerts when the app is closed."}
          </p>
        ) : state === "denied" ? (
          <p className="mt-0.5 text-xs text-slate-500">Notifications are blocked. Allow them for this site in your browser settings, then come back.</p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-slate-500">Know when someone writes to you, even when the app is closed.</p>
            <button type="button" onClick={turnOn} disabled={busy} className="glass-btn mt-2 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60">
              {busy ? "Turning on…" : "Turn on alerts"}
            </button>
          </>
        )}
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}
