"use client";

import { useRef, useState } from "react";
import { ChevronsRight, Loader2, Phone } from "lucide-react";

const KNOB = 56; // px

// A "slide to call" track: drag the knob all the way to the right to confirm (a tap can not start a call by accident).
// Keyboard: focus the knob and press Enter or Space. `busy` shows a spinner on the knob while the number is looked up.
export default function SlideToCall({ label, onComplete, busy = false, disabled = false }: { label: string; onComplete: () => void; busy?: boolean; disabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [x, setX] = useState(0);
  const [max, setMax] = useState(0); // how far the knob can travel, measured when a drag starts
  const measure = () => Math.max(0, (track.current?.clientWidth ?? 0) - KNOB - 8);

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setMax(measure());
    start.current = e.clientX - x;
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    setX(Math.min(max, Math.max(0, e.clientX - start.current)));
  }
  function up() {
    if (start.current === null) return;
    start.current = null;
    if (max > 0 && x >= max * 0.9) {
      setX(max);
      onComplete();
      setTimeout(() => setX(0), 1200);
    } else {
      setX(0);
    }
  }

  const done = max > 0 ? x / max : 0;
  return (
    <div ref={track} className={`relative h-16 select-none overflow-hidden rounded-full bg-gradient-to-r from-rose-600 to-red-500 p-1 shadow-[0_12px_28px_-12px_rgba(225,29,72,0.8)] ${disabled ? "opacity-50" : ""}`}>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 pl-12 text-sm font-semibold text-white" style={{ opacity: 1 - done }}>
        {label} <ChevronsRight size={18} className="animate-pulse" aria-hidden />
      </span>
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(done * 100)}
        disabled={disabled}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy && !disabled) { e.preventDefault(); onComplete(); } }}
        className="relative flex touch-none items-center justify-center rounded-full bg-white text-rose-600 shadow-md transition-[transform] duration-75"
        style={{ width: KNOB, height: KNOB, transform: `translateX(${x}px)` }}
      >
        {busy ? <Loader2 size={24} className="animate-spin" /> : <Phone size={24} />}
      </button>
    </div>
  );
}
