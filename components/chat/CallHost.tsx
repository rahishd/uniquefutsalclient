"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { acceptCall, checkIncoming, clearNotice, endCall, toggleMute, useCall } from "@/lib/call";
import { useSession } from "@/lib/session";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Mounted once in the layout: watches for an incoming call while signed in and shows the full-screen call (ringing, in a call, ended).
export default function CallHost() {
  const call = useCall();
  const session = useSession();
  const registered = session?.registered === true;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!registered) return;
    const tick = () => { if (document.visibilityState === "visible") void checkIncoming(); };
    tick();
    const t = setInterval(tick, 3000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [registered]);

  useEffect(() => {
    if (call.startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call.startedAt]);

  if (call.phase === "idle") {
    if (!call.notice) return null;
    return (
      <div role="status" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
        <span>{call.notice}</span>
        <button type="button" onClick={clearNotice} className="text-xs font-semibold text-slate-300">OK</button>
      </div>
    );
  }

  const status =
    call.phase === "calling" ? "Calling…"
    : call.phase === "incoming" ? "Incoming voice call"
    : call.phase === "connecting" ? "Connecting…"
    : call.startedAt ? clock(now - call.startedAt) : "Connected";

  return (
    <div role="dialog" aria-modal="true" aria-label="Voice call" className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-[#0c0b5d] to-[#1e1b8f] px-6 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-[calc(env(safe-area-inset-top)+5rem)] text-white">
      <div className="flex flex-col items-center text-center">
        <div className={call.phase === "incoming" || call.phase === "calling" ? "animate-pulse" : ""}>
          <ProfileAvatar name={call.peer || "?"} captain={false} size={112} src={call.avatar} />
        </div>
        <p className="mt-5 text-2xl font-semibold">{call.peer}</p>
        <p className="mt-1 text-sm text-white/75" aria-live="polite">{status}</p>
      </div>

      {call.phase === "incoming" ? (
        <div className="flex items-center gap-16">
          <button type="button" onClick={() => void endCall()} aria-label="Decline" className="flex flex-col items-center gap-2 text-xs font-medium">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-600 shadow-lg active:scale-95 transition"><PhoneOff size={26} /></span>
            Decline
          </button>
          <button type="button" onClick={() => void acceptCall()} aria-label="Answer" className="flex flex-col items-center gap-2 text-xs font-medium">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 shadow-lg active:scale-95 transition"><Phone size={26} /></span>
            Answer
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-12">
          <button type="button" onClick={toggleMute} aria-pressed={call.muted} aria-label={call.muted ? "Unmute" : "Mute"} className="flex flex-col items-center gap-2 text-xs font-medium">
            <span className={`grid h-14 w-14 place-items-center rounded-full transition active:scale-95 ${call.muted ? "bg-white text-[#0c0b5d]" : "bg-white/15"}`}>{call.muted ? <MicOff size={22} /> : <Mic size={22} />}</span>
            {call.muted ? "Unmute" : "Mute"}
          </button>
          <button type="button" onClick={() => void endCall()} aria-label="End call" className="flex flex-col items-center gap-2 text-xs font-medium">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-600 shadow-lg active:scale-95 transition"><PhoneOff size={26} /></span>
            {call.phase === "calling" ? "Cancel" : "End"}
          </button>
        </div>
      )}
    </div>
  );
}
