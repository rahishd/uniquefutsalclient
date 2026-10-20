// The splash screen is shown ONLY right after someone signs in (password, Face ID or sign-up), never when the site is opened, refreshed
// or a new tab or window appears.
//
// The sign-in form finishes with a full page load (window.location.assign), which wipes anything kept in memory, so the form leaves a
// one-time marker in this tab's session storage (startLoginSplash). The next page picks it up when it loads, removes it, and plays the
// splash once (components/LoginSplash.tsx). A refresh, or a new tab, finds no marker and shows nothing.
import { useSyncExternalStore } from "react";

const FLAG = "uf-login-splash";
const FRESH_MS = 30_000; // a marker older than this is ignored (the sign-in did not lead to a page load)
const PLAY_MS = 6500; // the animation takes about 5.75 seconds (components/Splash.tsx, .uf-splash in globals.css), then it is gone

/** Call right before the page changes after a successful sign-in. */
export function startLoginSplash() {
  try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* private mode: no splash, nothing else is lost */ }
}

function takeMarker(): boolean {
  try {
    const v = sessionStorage.getItem(FLAG);
    sessionStorage.removeItem(FLAG);
    return !!v && Date.now() - Number(v) < FRESH_MS;
  } catch {
    return false;
  }
}

let on = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// runs once, when the first script of a page load starts: did a sign-in just finish on the previous page?
if (typeof window !== "undefined" && takeMarker()) {
  on = true;
  setTimeout(() => { on = false; emit(); }, PLAY_MS);
}

/** True while the sign-in splash is playing. */
export function useLoginSplash(): boolean {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => on,
    () => false,
  );
}
