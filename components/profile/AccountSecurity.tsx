"use client";

import { useEffect, useState } from "react";
import { errorText } from "@/lib/api";
import { disablePush, enablePush, pushState, sendTestAlert, type PushState } from "@/lib/push";
import { changeMyPassword } from "@/lib/google";

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// Account settings rows: password and alerts when the app is closed (Web Push). (The Face ID sign-in switch was taken off this page.)
export default function AccountSecurity() {
  const [push, setPush] = useState<PushState | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState<{ cur: string; next: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    pushState().then((s) => alive && setPush(s));
    return () => {
      alive = false;
    };
  }, []);

  async function togglePush(on: boolean) {
    setBusy(true);
    setPushError(null);
    try {
      if (on) {
        const r = await enablePush();
        if (!r.ok) setPushError(r.error);
      } else {
        await disablePush();
      }
    } catch (e) {
      setPushError(errorText(e));
    } finally {
      setPush(await pushState());
      setBusy(false);
    }
  }

  // "Send me a test alert": says in plain words where the chain stops if nothing arrives
  async function runTest() {
    setBusy(true);
    setTest(null);
    try {
      const r = await sendTestAlert();
      if (!r.serverReady) setTest({ ok: false, text: "Alerts are not switched on at the venue's server yet, so nothing can be sent. Please tell the venue." });
      else if (r.devices === 0) setTest({ ok: false, text: "The server does not know this phone yet. Switch on \"Alerts when the app is closed\" above, then try again." });
      else if (r.sent === 0) setTest({ ok: false, text: "The server tried, but your phone's alert service refused it. Switch the alerts off and on again, then try again." });
      else setTest({ ok: true, text: `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}. It should appear on this phone in a few seconds. Lock the phone to see it on your watch.` });
    } catch (e) {
      setTest({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function savePw() {
    if (!pw) return;
    setPwMsg(null);
    try {
      await changeMyPassword(pw.cur, pw.next);
      setPw(null);
      setPwMsg({ ok: true, text: "Your password was changed." });
    } catch (e) {
      setPwMsg({ ok: false, text: errorText(e) });
    }
  }

  return (
    <>
      <li>
        <div className="flex items-center justify-between gap-4">
          <span>
            Alerts when the app is closed
            <span className="block text-xs text-slate-400">Booking, payment and game reminders on this phone. On iPhone, add the app to your Home Screen first.</span>
          </span>
          <Switch checked={push === "on"} disabled={busy || push === null || push === "unsupported"} onChange={togglePush} label="Alerts when the app is closed" />
        </div>
        {push === "unsupported" && <p className="mt-1 text-xs text-slate-400">This browser cannot receive them.</p>}
        {push === "denied" && <p className="mt-1 text-xs text-amber-600">Blocked. Allow notifications for this site in your browser settings.</p>}
        {pushError && <p role="alert" className="mt-1 text-xs text-rose-600">{pushError}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void runTest()} disabled={busy} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand disabled:opacity-50">Send me a test alert</button>
        </div>
        {test && <p role="status" className={`mt-1.5 text-xs ${test.ok ? "text-emerald-600" : "text-rose-600"}`}>{test.text}</p>}
        <details className="mt-2 text-xs text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-500">Get alerts on your watch</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li><b>Apple Watch:</b> add this app to your iPhone Home Screen, switch alerts on above, then in the Watch app open Notifications and allow this app. Your watch shows them when the iPhone is locked.</li>
            <li><b>Samsung Galaxy Watch:</b> in Chrome or Samsung Internet allow notifications for this site, then in the Galaxy Wearable app open Watch settings, Notifications, and allow your browser.</li>
            <li>Not seeing them? Tap Send me a test alert. If it appears on the phone but not the watch, the watch is not mirroring this app yet.</li>
          </ul>
        </details>
      </li>
      <li>
        <div className="flex items-center justify-between gap-4">
          <span>
            Password
            <span className="block text-xs text-slate-400">Forgot your current password? Contact the admin and they will set a new one for you.</span>
          </span>
          <button type="button" onClick={() => setPw(pw ? null : { cur: "", next: "" })} className="shrink-0 text-xs font-medium text-brand">{pw ? "Close" : "Change"}</button>
        </div>
        {pw && (
          <div className="mt-3 space-y-2">
            <input type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} placeholder="Current password" autoComplete="current-password" aria-label="Current password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="New password (6+ characters)" autoComplete="new-password" aria-label="New password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" disabled={!pw.cur || pw.next.length < 6} onClick={savePw} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save password</button>
          </div>
        )}
        {pwMsg && <p role="alert" className={`mt-1 text-xs ${pwMsg.ok ? "text-brand" : "text-rose-600"}`}>{pwMsg.text}</p>}
      </li>
    </>
  );
}
