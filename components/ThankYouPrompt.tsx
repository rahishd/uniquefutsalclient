"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Gamepad2, PartyPopper, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { myBookingsStore, parseKey } from "@/lib/booking";
import { myGzStore } from "@/lib/gamezone";
import { markRead, noticesStore } from "@/lib/notifications";

// After the game: a thank-you pop-up with a Book now button. The bell gets the same message from the server (sendThankYouNotices in the
// backend jobs). The pop-up shows once per game, within 3 hours after it ended, for court bookings and Gamezone sessions of a signed-in customer.
const KEY = "uf-thanks-v1";
const LAST = "uf-thanks-last-v1"; // when a thank-you pop-up was last closed, so the bell notice and the game never show it twice
const WINDOW_MS = 3 * 60 * 60 * 1000;

export const THANKS_TITLE = "Thank you for choosing us";
interface Done { id: string; kind: "court" | "gamezone"; endsAt: number }

function seen(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; }
}
function lastShown(): number {
  try { return Number(localStorage.getItem(LAST) ?? 0); } catch { return 0; }
}
function remember(id: string) {
  try { localStorage.setItem(LAST, String(Date.now())); } catch { /* ignore */ }
  try { localStorage.setItem(KEY, JSON.stringify([...seen(), id].slice(-50))); } catch { /* shows again next time */ }
}

export function ThankYouDialog({ kind, onBook, onClose }: { kind: "court" | "gamezone"; onBook: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const Icon = kind === "gamezone" ? Gamepad2 : CalendarPlus;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-6" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="thanks-title" tabIndex={-1} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center text-[#14142b] shadow-[0_24px_60px_rgba(12,11,93,0.35)] outline-none">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf1ff] text-[#2c3da0]"><PartyPopper size={32} /></span>
        <h2 id="thanks-title" className="mt-4 text-2xl font-semibold">Thank you for choosing us</h2>
        <p className="mt-2 text-sm text-slate-500">Have a great day ahead!</p>
        <p className="mt-4 text-base font-medium">Will you book again for the coming days?</p>
        <button type="button" onClick={onBook} className="glass-btn mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white"><Icon size={18} aria-hidden /> Book now</button>
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm text-slate-400">Maybe later</button>
      </div>
    </div>
  );
}

export default function ThankYouPrompt() {
  const router = useRouter();
  const session = useSession();
  const courts = myBookingsStore.use().data;
  const gz = myGzStore.use().data;
  const notices = noticesStore.use().data;
  const [now, setNow] = useState(0);
  const [shown, setShown] = useState<string[]>([]);

  // games that ended within the last 3 hours
  const finished = useMemo<Done[]>(() => {
    const out: Done[] = [];
    for (const b of courts ?? []) {
      if (b.status !== "confirmed" && b.status !== "completed") continue;
      if (b.notes?.includes("MEMBERSHIP_")) continue;
      const start = parseInt(b.startTime.split(":")[0], 10);
      let end = parseInt(b.endTime.split(":")[0], 10);
      if (end <= start) end += 24;
      const d = parseKey(b.date);
      d.setHours(end, 0, 0, 0);
      out.push({ id: b.id, kind: "court", endsAt: d.getTime() });
    }
    for (const g of gz ?? []) {
      if (g.status !== "confirmed" && g.status !== "completed") continue;
      const d = new Date(`${g.date}T00:00:00`);
      d.setHours(g.startHour + g.hours, 0, 0, 0);
      out.push({ id: g.code, kind: "gamezone", endsAt: d.getTime() });
    }
    return out;
  }, [courts, gz]);

  // check every 30 s and when the tab comes back
  useEffect(() => {
    if (!session?.registered) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [session?.registered]);

  if (!session?.registered || !now) return null;
  const done = seen();
  const last = lastShown();
  const game = finished.filter((f) => f.endsAt <= now && now - f.endsAt <= WINDOW_MS && f.endsAt > last && !done.includes(f.id) && !shown.includes(f.id)).sort((a, b) => b.endsAt - a.endsAt)[0];
  // the same message arrives in the bell from the server; if it is still unread, show it as a pop-up too (for example when the game
  // was booked on another phone). Closing the pop-up marks it read.
  const notice = (notices?.items ?? []).find((n) => !n.read && n.title === THANKS_TITLE && n.at > last && now - n.at <= WINDOW_MS && !shown.includes("n:" + n.id));
  const due = game ? { key: game.id, kind: game.kind } : notice ? { key: "n:" + notice.id, kind: (notice.type === "gamezone" ? "gamezone" : "court") as "court" | "gamezone" } : null;
  if (!due) return null;

  const close = () => {
    remember(due.key);
    setShown((s) => [...s, due.key]);
    for (const n of notices?.items ?? []) if (!n.read && n.title === THANKS_TITLE) void markRead(n.id);
  };
  const book = () => { close(); router.push(due.kind === "gamezone" ? "/gamezone" : "/book"); };
  return <ThankYouDialog kind={due.kind} onBook={book} onClose={close} />;
}
