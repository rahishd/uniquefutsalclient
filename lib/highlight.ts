"use client";

// Shows the customer exactly which record a notification was about. A notice opens its page with ?hl=<record id>; the page
// marks each row data-hl="<record id>", and that row scrolls into view and blinks for 5 seconds (or until the next tap).
// The page may still be loading, so the row is looked for a few seconds. Tapping a notice while already on that page sends the
// same request as an event, because the address change alone does not reload the page.
import { useEffect } from "react";

export const HIGHLIGHT_EVENT = "uf:highlight";
export const hlOf = (href?: string | null) => { try { return href ? new URL(href, "http://x").searchParams.get("hl") : null; } catch { return null; } };

export function useHighlight(onTarget?: (id: string) => void) {
  useEffect(() => {
    let stop: (() => void) | null = null;

    const run = (id: string) => {
      stop?.();
      onTarget?.(id);
      const started = Date.now();
      let el: HTMLElement | null = null;
      let off: () => void = () => {};
      const look = setInterval(() => {
        el = document.querySelector<HTMLElement>(`[data-hl="${CSS.escape(id)}"]`);
        if (!el && Date.now() - started < 6000) return;
        clearInterval(look);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("uf-hl");
        const t = setTimeout(() => off(), 5000);
        const arm = setTimeout(() => document.addEventListener("pointerdown", () => off(), { once: true }), 400);
        off = () => { el?.classList.remove("uf-hl"); clearTimeout(t); clearTimeout(arm); };
      }, 200);
      stop = () => { clearInterval(look); off(); };
    };

    // opened by a link with ?hl=
    const params = new URLSearchParams(window.location.search);
    const id = params.get("hl");
    if (id) {
      params.delete("hl");
      const rest = params.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
      run(id);
    }
    // tapped while already on this page
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<string>).detail;
      if (!d) return;
      const q = new URLSearchParams(window.location.search);
      q.delete("hl");
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
      run(d);
    };
    window.addEventListener(HIGHLIGHT_EVENT, onEvent);
    return () => { window.removeEventListener(HIGHLIGHT_EVENT, onEvent); stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
