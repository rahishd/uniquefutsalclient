"use client";

import { useEffect, useRef } from "react";

// Full-screen photo background that changes as the page is scrolled: photo 1, then 2, 3, 4, 5, and back again when
// scrolling up. It sits behind the page (fixed, pointer-events none), so layout, clicks and typing are unaffected.
//
// How it stays smooth:
// - Scroll position is turned into opacity values directly on the image layers inside one requestAnimationFrame.
//   React state is never touched while scrolling.
// - Only the two photos around the current position are visible; the rest stay at opacity 0 and hidden.
// - Each photo is decoded before it is allowed to fade in, and the next ones are prepared ahead of time. A photo
//   that is not ready yet is simply not faded in (the one before it stays), so there is never a blank frame.
// - Each photo holds still for a while before and after its crossfade, so it can be looked at.
// - The photos are kept sharp but very faint: the whole stack is drawn at STRENGTH (10%) opacity over the white page.
// - A photo that fails to load is skipped. With "reduce motion" on, the first photo is shown and nothing animates.

const COUNT = 5;
const photo = (n: number, w: 800 | 1600) => `/backgrounds/bg-${n}-${w}.webp`;
const HOLD = 0.28; // share of each step during which the photo is held without any fading
const AHEAD = 2; // how many photos past the current one are prepared
const STRENGTH = 0.1; // how strongly the photos show: 10% over the white page

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function ScrollBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const layers = Array.from(root.querySelectorAll<HTMLImageElement>("img[data-layer]"));
    const html = document.documentElement;
    html.classList.add("has-backdrop");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state: ("idle" | "loading" | "ready" | "failed")[] = layers.map(() => "idle");
    const shown = layers.map(() => -1); // last opacity written, to skip no-op writes
    let lastFull = 0; // the photo that was fully visible most recently
    let frame = 0;
    let docMax = 1;
    let disposed = false;

    // Phones get the smaller files; large or sharp screens get the bigger ones.
    const pickWidth = (): 800 | 1600 => (window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) > 900 ? 1600 : 800);

    function prepare(i: number) {
      if (i < 0 || i >= layers.length || state[i] !== "idle") return;
      state[i] = "loading";
      const url = photo(i + 1, pickWidth());
      const probe = new Image();
      probe.decoding = "async";
      probe.src = url;
      const done = () => {
        if (disposed) return;
        layers[i].src = url; // cached by now, so this is instant
        state[i] = "ready";
        schedule();
      };
      const failed = () => {
        if (disposed) return;
        state[i] = "failed";
        schedule();
      };
      if (typeof probe.decode === "function") probe.decode().then(done, failed);
      else {
        probe.onload = done;
        probe.onerror = failed;
      }
    }

    function write(i: number, opacity: number) {
      const o = Math.round(opacity * 1000) / 1000;
      if (shown[i] === o) return;
      shown[i] = o;
      const el = layers[i];
      el.style.opacity = String(o);
      el.style.visibility = o === 0 ? "hidden" : "visible";
    }

    function update() {
      frame = 0;
      if (disposed) return;
      const p = docMax > 0 ? clamp(window.scrollY / docMax, 0, 1) : 0;
      const usable = layers.map((_, i) => i).filter((i) => state[i] !== "failed");
      if (!usable.length) return;
      const pos = reduce ? 0 : p * (usable.length - 1);
      const step = clamp(Math.floor(pos), 0, Math.max(0, usable.length - 2));
      const frac = usable.length > 1 ? clamp(pos - step, 0, 1) : 0;
      const t = smooth(clamp((frac - HOLD) / (1 - 2 * HOLD), 0, 1));
      const cur = usable[step];
      const next = usable[Math.min(step + 1, usable.length - 1)];

      // prepare the photos around here
      for (let k = Math.max(0, step - 1); k <= step + AHEAD; k++) if (k < usable.length) prepare(usable[k]);

      let curO = 1 - t;
      let nextO = cur === next ? 0 : t;
      // never fade towards a photo that is not decoded yet
      if (nextO > 0 && state[next] !== "ready") {
        curO = 1;
        nextO = 0;
      }
      if (state[cur] !== "ready") {
        // the current photo is still loading: keep the last visible one on screen
        curO = 0;
        const keep = state[lastFull] === "ready" ? lastFull : usable.find((i) => state[i] === "ready");
        for (let i = 0; i < layers.length; i++) write(i, i === keep ? 1 : 0);
        return;
      }
      for (let i = 0; i < layers.length; i++) write(i, i === cur ? curO : i === next ? nextO : 0);
      if (curO >= 0.999) lastFull = cur;
      else if (nextO >= 0.999) lastFull = next;
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    function measure() {
      docMax = Math.max(1, html.scrollHeight - window.innerHeight);
      schedule();
    }

    // first photo straight away, neighbours right after
    prepare(0);
    measure();
    if (!reduce) {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", measure, { passive: true });
      window.addEventListener("orientationchange", measure);
    }
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (!reduce) (idle ?? ((cb: () => void) => window.setTimeout(cb, 600)))(() => prepare(1));

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro?.disconnect();
      html.classList.remove("has-backdrop");
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="scroll-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white">
      {/* one group opacity for the whole stack, so the crossfade inside it stays exact */}
      <div className="absolute inset-0" style={{ opacity: STRENGTH }}>
        {Array.from({ length: COUNT }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            data-layer
            alt=""
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
            style={{ opacity: 0, visibility: "hidden", willChange: "opacity" }}
          />
        ))}
      </div>
    </div>
  );
}
