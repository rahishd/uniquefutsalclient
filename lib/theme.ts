"use client";

// Light or dark look, kept in this browser. app/layout.tsx applies the saved choice before the page paints,
// so there is no flash of the wrong colours. Dark mode is drawn by the `html.dark` rules in globals.css.

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export const THEME_KEY = "uf-theme";
const listeners = new Set<() => void>();

const read = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const set = useCallback((t: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage blocked: the look lasts until the page is reloaded */
    }
    document.documentElement.classList.toggle("dark", t === "dark");
    listeners.forEach((f) => f());
  }, []);
  return [theme, set];
}
