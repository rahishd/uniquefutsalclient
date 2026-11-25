"use client";

import { useEffect, useRef, useState } from "react";

// Pull the page down from the very top: a small spinning ball drops in; let go past the line and the page reloads, the ball keeps spinning until it has.
const TRIGGER = 70; // pulled this far (px) = reload on release
const MAX = 110;

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const dist = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const atTop = () => (window.scrollY || document.documentElement.scrollTop) <= 0;
    // a dialog or sheet is open (the page behind is locked), or the finger is inside something that scrolls on its own
    const blocked = (t: EventTarget | null) => {
      if (document.body.style.overflow === "hidden") return true;
      for (let el = t as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return true;
        if (el.getAttribute?.("role") === "dialog") return true;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || !atTop() || blocked(e.target)) { start.current = null; return; }
      start.current = e.touches[0].clientY;
      dist.current = 0;
      setDragging(true);
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null || busy.current) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || !atTop()) { if (dist.current) { dist.current = 0; setPull(0); } return; }
      if (e.cancelable) e.preventDefault();
      dist.current = Math.min(MAX, dy * 0.5);
      setPull(dist.current);
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      setDragging(false);
      if (dist.current >= TRIGGER && !busy.current) {
        busy.current = true;
        setLoading(true);
        setPull(TRIGGER);
        setTimeout(() => window.location.reload(), 350);
      } else {
        dist.current = 0;
        setPull(0);
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (pull <= 0 && !loading) return null;
  const y = Math.min(pull, MAX);
  return (
    <div aria-hidden={!loading} role={loading ? "status" : undefined} aria-label="Refreshing" className="pointer-events-none fixed left-0 right-0 z-[90] flex justify-center" style={{ top: "calc(env(safe-area-inset-top) + 8px)", transform: `translateY(${y - 44}px)`, transition: !dragging ? "transform .25s ease" : "none", opacity: Math.min(1, y / 40) }}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl shadow-lg ring-1 ring-slate-200">
        <span className={loading ? "animate-spin" : ""} style={loading ? undefined : { transform: `rotate(${y * 6}deg)` }}>⚽</span>
      </span>
    </div>
  );
}
