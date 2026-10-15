"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ChevronRight, Clock, Loader2, UserMinus, UserPlus, Users, Wallet, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { formatHour, formatRs, parseKey } from "@/lib/booking";
import { cancelRequest, joinRequest, leaveRequest, playersLabel, requestsStore, type PlayerRequest } from "@/lib/playerRequests";

export function whenText(r: Pick<PlayerRequest, "date" | "hour">) {
  const day = parseKey(r.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${formatHour(r.hour)} – ${formatHour(r.hour + 1)}`;
}

function dueText(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// One "players needed" deal: who needs how many, when, the spots left, the equal split, and the buttons that fit
// the viewer: I'm in / Leave for a player, Pay advance / Cancel for the host.
export default function RequestCard({ r, detail = false, onChanged, onPayAdvance }: { r: PlayerRequest; detail?: boolean; onChanged?: (next: PlayerRequest) => void; onPayAdvance?: () => void }) {
  const [busy, setBusy] = useState<"join" | "leave" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "join" | "leave" | "cancel", fn: () => Promise<PlayerRequest>) {
    setBusy(kind);
    setError(null);
    try {
      const next = await fn();
      requestsStore.refresh();
      onChanged?.(next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const closed = r.status === "cancelled" || r.status === "expired";
  const pct = Math.round((r.joined / r.playersNeeded) * 100);
  const waiting = r.status === "awaiting_advance";

  return (
    <article className="glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.mine ? "You need" : `${r.posterName} needs`}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600"><CalendarClock size={15} /> {whenText(r)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-100 px-3 py-1.5 text-sm font-bold text-[#0c0b5d]">+{r.playersNeeded}</span>
      </div>

      {r.note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">&ldquo;{r.note}&rdquo;</p>}

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1"><Users size={13} /> {r.joined} of {playersLabel(r.playersNeeded)} joined</span>
          <span className="font-semibold text-slate-700">
            {r.status === "cancelled" ? "Cancelled" : r.status === "expired" ? "Started" : r.confirmed ? "Confirmed" : r.spotsLeft === 0 ? "All in" : `${r.spotsLeft} left`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#0c0b5d]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {r.joiners && r.joiners.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {r.joiners.map((j) => (
            <li key={j.phone} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-[#0c0b5d]">{j.name} · {j.phone}</li>
          ))}
        </ul>
      )}

      {r.courtPrice > 0 && !closed && (
        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Friendly game: the cost is shared equally</p>
          <p className="mt-0.5">
            Court {formatRs(r.courtPrice)} · {r.everyone} players · about <span className="font-semibold">{formatRs(r.sharePerPlayer)} each</span>, whoever wins or loses. Paid at the venue.
          </p>
          {r.mine && (
            <p className="mt-0.5">
              Your share {formatRs(r.hostShare)}: Rs. {r.advanceFee} advance online, then {formatRs(r.hostPaysAtVenue)} at the venue.
            </p>
          )}
        </div>
      )}

      {waiting && r.mine && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-400/15 px-3 py-2.5 text-xs text-amber-800">
          <Clock size={14} className="mt-0.5 shrink-0" />
          <span>Everyone has joined. Pay the Rs. {r.advanceFee} advance to book the court{r.advanceDueAt ? ` before ${dueText(r.advanceDueAt)}` : ""}, or the request is cancelled.</span>
        </p>
      )}
      {waiting && !r.mine && (
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">All players are in. Waiting for the host to pay the advance and book the court.</p>
      )}
      {r.confirmed && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700"><Check size={14} /> The court is booked. See you there.</p>
      )}

      {!closed && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.mine ? (
            <>
              {waiting &&
                (detail ? (
                  <button type="button" onClick={onPayAdvance} className="glass-btn flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold">
                    <Wallet size={15} /> Pay Rs. {r.advanceFee} advance
                  </button>
                ) : (
                  <Link href={`/find-player/${r.id}`} className="glass-btn flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold">
                    <Wallet size={15} /> Pay Rs. {r.advanceFee} advance
                  </Link>
                ))}
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  if (!(await askConfirm(r.confirmed ? "Cancel this game? The court booking will be cancelled and the players told." : "Cancel this request? The players who joined will be told."))) return;
                  await run("cancel", () => cancelRequest(r.id));
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60"
              >
                {busy === "cancel" ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Cancel
              </button>
            </>
          ) : r.joinedByMe ? (
            <>
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700"><Check size={15} /> You&apos;re in</span>
              {!r.confirmed && (
                <button type="button" disabled={busy !== null} onClick={() => run("leave", () => leaveRequest(r.id))} className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-60">
                  {busy === "leave" ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />} Leave
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={busy !== null || r.spotsLeft === 0 || r.status !== "open"}
              onClick={() => run("join", () => joinRequest(r.id))}
              className="glass-btn flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy === "join" ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} {r.spotsLeft === 0 || r.status !== "open" ? "Full" : "I'm in"}
            </button>
          )}
          {!detail && (
            <Link href={`/find-player/${r.id}`} aria-label="View the deal" className="flex items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-[#0c0b5d]">
              <ChevronRight size={18} />
            </Link>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-sm text-red-600">{error}</p>}
    </article>
  );
}
