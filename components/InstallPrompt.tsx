"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, MoreVertical, PlusSquare, Share, X } from "lucide-react";
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

export default function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "android-menu" | "ios" | null>(null);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const session = useSession();
  const signedIn = session?.registered === true;

  const open = useCallback(() => {
    if (isStandalone() || wasDismissedThisVisit()) return;
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

  async function install() {
    const evt = deferred.current;
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred.current = null;
    if (outcome === "dismissed") dismiss();
    else setMode(null);
  }

  if (!mode) return null;

  return (
    <div role="dialog" aria-label="Install Unique Futsal" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[60] px-4 desk:inset-x-auto desk:bottom-6 desk:left-6 desk:w-[24rem] desk:px-0">
      <div className="glass relative mx-auto max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: "rgba(255,255,255,0.98)" }}>
        <button type="button" onClick={dismiss} aria-label="Close" className="absolute right-4 top-4 text-slate-400">
          <X size={18} />
        </button>
        <div className="flex items-center gap-3 pr-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-base font-bold text-white shadow-md">UF</span>
          <div>
            <p className="font-semibold">Get the Unique Futsal app</p>
            <p className="text-xs text-slate-500">Keep it on your home screen for one-tap booking, reminders and offers.</p>
          </div>
        </div>

        {mode === "android" && (
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={dismiss} className="flex-1 rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600">Not now</button>
            <button type="button" onClick={install} className="glass-btn flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold">
              <Download size={16} /> Download app
            </button>
          </div>
        )}

        {mode === "android-menu" && (
          <>
            <ol className="mt-4 space-y-2 text-sm text-slate-600">
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
            <button type="button" onClick={dismiss} className="mt-4 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600">Got it</button>
          </>
        )}

        {mode === "ios" && (
          <>
            <ol className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">1</span>
                Tap the <Share size={16} className="text-brand" aria-label="Share" /> Share button in your browser
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">2</span>
                Choose <PlusSquare size={16} className="text-brand" aria-hidden /> <b>Add to Home Screen</b>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">3</span>
                Tap <b>Add</b>, and &ldquo;Unique Futsal&rdquo; appears on your home screen
              </li>
            </ol>
            <button type="button" onClick={dismiss} className="mt-4 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600">Got it</button>
          </>
        )}
      </div>
    </div>
  );
}
