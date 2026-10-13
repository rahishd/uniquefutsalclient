"use client";

// Language: English or Nepali. The choice is kept in this browser (so guests can use it too) and, for a signed-in
// customer, saved on their account (Profile > Settings) so it follows them to other devices.
// The whole page is translated by components/PageTranslator.tsx using lib/translate.ts and lib/ne-dictionary.ts.
// useT() is for text that is not drawn in the page (for example a picture or a message); anything not in the
// dictionary simply stays in English.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isDictionaryReady, loadDictionary, subscribeDictionary, translateText } from "@/lib/translate";
import { setPref, usePrefs } from "@/lib/prefs";
import { useSession } from "@/lib/session";

export type Lang = "en" | "ne";
const KEY = "uf-lang";
const listeners = new Set<() => void>();

const read = (): Lang | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "ne" || v === "en" ? v : null;
  } catch {
    return null;
  }
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLang(): [Lang, (l: Lang) => void] {
  const prefs = usePrefs();
  const session = useSession();
  const local = useSyncExternalStore(subscribe, read, () => null);
  const lang: Lang = local ?? (prefs.language === "ne" ? "ne" : "en");
  const set = useCallback(
    (l: Lang) => {
      try {
        localStorage.setItem(KEY, l);
      } catch {
        /* storage blocked: the choice lasts for this visit only through the account setting */
      }
      document.documentElement.lang = l;
      listeners.forEach((f) => f());
      if (session?.registered) void setPref("language", l);
    },
    [session?.registered],
  );
  return [lang, set];
}

export function useT() {
  const [lang] = useLang();
  const ready = useSyncExternalStore(subscribeDictionary, isDictionaryReady, () => false);
  useEffect(() => {
    if (lang === "ne") void loadDictionary();
  }, [lang]);
  return useCallback((en: string) => (lang === "ne" && ready ? translateText(en) : en), [lang, ready]);
}
