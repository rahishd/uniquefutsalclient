"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTeams } from "@/lib/teams";

// The round red "(C)" badge on the phone Home header. Tapping it opens the captain's card: the captain, the team name and its players.
export default function CaptainBadge() {
  const teams = useTeams();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const team = teams?.team ?? null;
  const captain = team?.members.find((m) => m.isCaptain);
  const players = team?.members.filter((m) => !m.isCaptain) ?? [];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Captain profile" title="Captain profile" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-red-300 !bg-red-100">
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-red-500 text-sm font-extrabold leading-none text-white">C</span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 tab:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Captain profile" onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-red-300 bg-red-100">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-red-500 text-base font-extrabold text-white">C</span>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold leading-tight text-[#14142b]">{captain?.name ?? "Captain"}</p>
                  <p className="text-xs font-medium text-red-600">Team captain</p>
                  {captain?.phone && <p className="text-xs tabular-nums text-[#6b6b80]">{captain.phone}</p>}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full !bg-slate-100 text-[#4b4b66]"><X size={16} /></button>
            </div>

            {teams === undefined ? (
              <p className="mt-5 text-sm text-[#6b6b80]">Loading...</p>
            ) : !team ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-[#4b4b66]">
                You have no team yet.
                <Link href="/team" onClick={() => setOpen(false)} className="mt-3 block rounded-xl bg-[#0c0b5d] py-2.5 text-center font-semibold text-white">Create your team</Link>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-2xl bg-[#e4efff] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4b4b66]">Team</p>
                  <p className="text-xl font-extrabold leading-tight text-[#0c0b5d]">{team.name}</p>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-[#4b4b66]">
                    {[["Played", team.record.played], ["Won", team.record.wins], ["Drawn", team.record.draws], ["Lost", team.record.losses]].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-white py-2"><p className="text-base font-bold tabular-nums text-[#14142b]">{v}</p>{k}</div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[#4b4b66]">{team.rating === null ? "Unrated" : `Rating ${team.rating.toFixed(1)}`}{team.rank ? ` · Rank #${team.rank}` : ""}</p>
                </div>

                <p className="mt-4 text-sm font-semibold text-[#14142b]">Players ({team.members.length}/{team.maxPlayers})</p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {captain && (
                    <li className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="truncate font-medium text-[#14142b]">{captain.name}</span>
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">Captain</span>
                    </li>
                  )}
                  {players.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="truncate text-[#14142b]">{m.name}</span>
                      {m.position && <span className="shrink-0 text-xs text-[#6b6b80]">{m.position}</span>}
                    </li>
                  ))}
                  {players.length === 0 && <li className="px-3 py-2.5 text-sm text-[#6b6b80]">No other players yet.</li>}
                </ul>
                <Link href="/team" onClick={() => setOpen(false)} className="mt-4 block rounded-xl bg-[#0c0b5d] py-2.5 text-center text-sm font-semibold text-white">Manage team</Link>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
