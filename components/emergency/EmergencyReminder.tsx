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
    <div role="note" className={`flex items-start gap-3 rounded-3xl bg-gradient-to-br from-[#4457c4] via-[#3345b0] to-[#2c3da0] p-4 text-white ring-1 ring-[#4a5cc8] shadow-[0_8px_22px_-12px_rgba(51,69,176,0.6)] ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white"><HeartPulse size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Add an emergency contact</p>
        <p className="mt-0.5 text-xs text-sky-100/90">For emergency situations: if you get hurt at the venue, we (and your teammates) can call them straight away.</p>
        <Link href="/profile#emergency" className="mt-2 inline-flex rounded-full bg-white px-4 py-1.5 text-xs font-bold" style={{ color: "#2c3da0" }}>Add now</Link>
      </div>
      <button type="button" onClick={remindLater} aria-label="Remind me later" title="Remind me later" className="shrink-0 rounded-full p-1 text-white/70 hover:text-white"><X size={18} /></button>
    </div>
  );
}
