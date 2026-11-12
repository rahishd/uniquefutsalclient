"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, MoreVertical, PlusSquare, X } from "lucide-react";
import { useSession } from "@/lib/session";

// Chrome/Android fires this event when the app is installable.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// "Not now" hides the popup for this visit only. It comes back every time the site is opened again and after every sign-in,
// until the app is on the home screen. (A browser cannot add itself to the home screen: the customer must tap once.)
const DISMISS_KEY = "uf-install-dismissed-visit";
const OLD_DISMISS_KEY = "uf-install-dismissed"; // earlier versions hid the popup forever
const SHOW_DELAY_MS = 1500;
const AUTO_CLOSE_S = 5; // the popup closes by itself after this many seconds, with a countdown
const AUTO_CLOSE_STEPS_S = 10; // the browser-menu steps take longer to read
const ANDROID_FALLBACK_MS = 4000; // some Android browsers never fire the install event; show the menu steps instead

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Any browser on an iPhone or iPad (iPadOS reports as a Mac with touch). iOS 16.4+ lets Chrome and others add to the home screen too.
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const isAndroid = () => /Android/i.test(navigator.userAgent);

function wasDismissedThisVisit() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// The countdown under the buttons. It starts when the popup appears and closes it at 0; while `paused` (the person pressed Download) it waits.
function AutoClose({ seconds, paused, onDone }: { seconds: number; paused: boolean; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => { if (left <= 0) onDone(); }, [left, onDone]);
  if (paused) return null;
  return <p role="timer" aria-live="off" className="mt-2 text-center text-[10px] font-medium text-slate-400">Closing in {Math.max(left, 0)}s</p>;
}

export default function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "android-menu" | "ios" | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false); // the browser's own install window is open
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const session = useSession();
  const signedIn = session?.registered === true;

  const open = useCallback(() => {
    // the install popup is for phones and tablets only: never on a desktop web browser, not even once
    if (isStandalone() || wasDismissedThisVisit() || !(isIos() || isAndroid())) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (isIos()) {
      timers.current.push(setTimeout(() => setMode("ios"), SHOW_DELAY_MS));
    } else if (deferred.current) {
      timers.current.push(setTimeout(() => setMode("android"), SHOW_DELAY_MS));
    } else if (isAndroid()) {
      // no install event yet: give it a moment, then fall back to the browser menu steps
      timers.current.push(setTimeout(() => setMode(deferred.current ? "android" : "android-menu"), ANDROID_FALLBACK_MS));
    }
  }, []);

  useEffect(() => {
    try { localStorage.removeItem(OLD_DISMISS_KEY); } catch { /* storage blocked */ }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep the event so we can show our own popup
      deferred.current = e as BeforeInstallPromptEvent;
      open();
    };
    const onInstalled = () => { deferred.current = null; setMode(null); };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    open();
    const pending = timers;
    return () => {
      pending.current.forEach(clearTimeout);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [open]);

  // signing in counts as a new visit: show it again even if it was closed before signing in
  useEffect(() => {
    if (!signedIn) return;
    try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* storage blocked */ }
    open();
  }, [signedIn, open]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage blocked: popup may reappear on the next page
    }
    setMode(null);
  }

  // iPhone has no install button for websites. This opens the Share sheet in one tap, where "Add to Home Screen" is one row away.
  async function iosDownload() {
    setIosHint(true);
    try {
      await navigator.share?.({ title: "Unique Futsal", url: window.location.origin });
    } catch {
      // closed without choosing: the hint above stays so they can try again
    }
  }

  async function install() {
    const evt = deferred.current;
    if (!evt) return;
    setInstalling(true);
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred.current = null;
    setInstalling(false);
    if (outcome === "dismissed") dismiss();
    else setMode(null);
  }

  if (!mode) return null;
  const seconds = mode === "android-menu" ? AUTO_CLOSE_STEPS_S : AUTO_CLOSE_S;
  const paused = iosHint || installing;

  return (
    <div role="dialog" aria-label="Install Unique Futsal" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[60] px-4 desk:inset-x-auto desk:bottom-6 desk:left-6 desk:w-[24rem] desk:px-0">
      <div className="relative mx-auto max-w-xs rounded-2xl border border-slate-300 bg-white p-3.5 shadow-lg">
        <button type="button" onClick={dismiss} aria-label="Cancel" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center text-slate-500">
          <svg aria-hidden viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="16" fill="none" stroke="#2c3da0" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray="100" className="uf-install-ring" style={{ animationDuration: `${seconds}s`, animationPlayState: paused ? "paused" : "running" }} />
          </svg>
          <X size={13} className="relative" />
        </button>
        <div className="flex items-center gap-2.5 pr-8">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white shadow-sm">UF</span>
          <div>
            <p className="text-sm font-semibold leading-tight">Get the Unique Futsal app</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Keep it on your home screen for one-tap booking, reminders and offers.</p>
          </div>
        </div>

        {mode === "android" && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={dismiss} className="flex-1 rounded-full bg-slate-100 py-2 text-xs font-medium text-slate-600">Cancel</button>
            <button type="button" onClick={install} className="glass-btn flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold">
              <Download size={14} /> Download app
            </button>
          </div>
        )}

        {mode === "android-menu" && (
          <>
            <ol className="mt-3 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">1</span>
                Tap the <MoreVertical size={16} className="text-brand" aria-label="Menu" /> menu in your browser
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">2</span>
                Choose <b>Install app</b> or <b>Add to Home screen</b>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">3</span>
                Tap <b>Install</b>, and the app appears on your home screen
              </li>
            </ol>
            <button type="button" onClick={dismiss} className="mt-3 w-full rounded-full bg-slate-100 py-2 text-xs font-medium text-slate-600">Got it</button>
          </>
        )}

        {mode === "ios" && (
          <>
            {iosHint && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-slate-700">
                <PlusSquare size={18} className="shrink-0 text-brand" aria-hidden />
                <span>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</span>
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={dismiss} className="flex-1 rounded-full bg-slate-100 py-2 text-xs font-medium text-slate-600">Cancel</button>
              <button type="button" onClick={iosDownload} className="glass-btn flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold">
                <Download size={14} /> Download now
              </button>
            </div>
          </>
        )}
        <AutoClose seconds={seconds} paused={paused} onDone={dismiss} />
      </div>
    </div>
  );
}
