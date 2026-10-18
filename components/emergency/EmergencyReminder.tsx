"use client";

import { useState } from "react";
import Link from "next/link";
import { HeartPulse, X } from "lucide-react";
import { useSession } from "@/lib/session";

const LATER_KEY = "uf-emergency-later"; // "remind me later": hidden for a day on this device
const DAY = 24 * 60 * 60 * 1000;

// A banner for signed-in customers with no emergency contact on their account (accounts made before it was asked,
// or through Google). It links to Profile > Emergency contact and comes back the next day if they choose Later.
export default function EmergencyReminder({ className = "" }: { className?: string }) {
  const session = useSession();
  // read once on the device (on the server the session is unknown, so nothing is shown there anyway)
  const [later, setLater] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return Date.now() - Number(localStorage.getItem(LATER_KEY) ?? 0) < DAY;
    } catch {
      return false;
    }
  });

  // only when the server said there is none (undefined = not known yet)
  if (!session?.registered || session.emergency !== false || later) return null;

  function remindLater() {
    try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch { /* storage blocked */ }
    setLater(true);
  }

  return (
    <div role="note" className={`flex items-start gap-3 rounded-3xl bg-rose-50 p-4 text-rose-900 ring-1 ring-rose-200 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600"><HeartPulse size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Add an emergency contact</p>
        <p className="mt-0.5 text-xs text-rose-800/80">For emergency situations: if you get hurt at the venue, we (and your teammates) can call them straight away.</p>
        <Link href="/profile#emergency" className="mt-2 inline-flex rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold" style={{ color: "#ffffff" }}>Add now</Link>
      </div>
      <button type="button" onClick={remindLater} aria-label="Remind me later" title="Remind me later" className="shrink-0 rounded-full p-1 text-rose-400 hover:text-rose-600"><X size={18} /></button>
    </div>
  );
}
