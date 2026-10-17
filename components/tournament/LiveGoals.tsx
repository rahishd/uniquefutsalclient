"use client";

import { CalendarClock, Radio } from "lucide-react";
import { matchTime, type TieGoal, type TieMatch, type TieRound } from "@/lib/tournament";

// "Live goal status": every match that is being played right now as a scoreboard (teams, score, who scored and when).
// With no live match it says so, and shows what is next, or the latest result, so the section is never an empty hole.
// The numbers come from the venue's live updates; the page refreshes them every 30 seconds.

const flat = (rounds: TieRound[]) => rounds.flatMap((r) => r.matches.map((m) => ({ ...m, round: r.name })));
type RM = TieMatch & { round: string };

function Scorers({ goals, side }: { goals: TieGoal[]; side: "home" | "away" }) {
  const mine = goals.filter((g) => g.side === side);
  return (
    <ul className={`space-y-1 text-xs ${side === "away" ? "text-right" : ""}`}>
      {mine.length === 0 && <li className="text-slate-300">–</li>}
      {mine.map((g, i) => (
        <li key={i} className="truncate text-slate-600">
          <span aria-hidden>⚽</span> {g.scorer || "Goal"}
          {g.minute !== null && <span className="ml-1 font-semibold text-slate-400">{g.minute}&prime;</span>}
        </li>
      ))}
    </ul>
  );
}

function Scoreboard({ m }: { m: RM }) {
  const goals = m.goals ?? [];
  return (
    <article className="overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-[0_10px_30px_-18px_rgba(225,29,72,0.45)]">
      <div className="flex items-center justify-between bg-rose-50 px-5 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-600">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" /></span>
          Live {m.note}
        </span>
        <span className="text-[11px] font-medium text-slate-400">{m.round}{m.venue ? ` · ${m.venue}` : ""}</span>
      </div>

      <div className="px-5 pb-4 pt-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="text-right text-sm font-semibold leading-tight text-slate-800">{m.home ?? "To be decided"}</p>
          <p className="rounded-2xl bg-[#0c0b5d] px-4 py-2 text-3xl font-extrabold tabular-nums leading-none text-white" aria-label={`Score ${m.homeScore ?? 0} to ${m.awayScore ?? 0}`}>
            {m.homeScore ?? 0}<span className="mx-1.5 text-white/50">:</span>{m.awayScore ?? 0}
          </p>
          <p className="text-sm font-semibold leading-tight text-slate-800">{m.away ?? "To be decided"}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3" aria-label="Goal scorers">
          <Scorers goals={goals} side="home" />
          <Scorers goals={goals} side="away" />
        </div>
      </div>
    </article>
  );
}

export default function LiveGoals({ rounds }: { rounds: TieRound[] }) {
  const all = flat(rounds);
  const live = all.filter((m) => m.status === "live");
  const next = all.filter((m) => m.status === "upcoming" && m.home && m.away).sort((a, b) => String(a.startsAt ?? "").localeCompare(String(b.startsAt ?? "")))[0];
  const last = [...all].filter((m) => m.status === "finished").sort((a, b) => String(b.startsAt ?? "").localeCompare(String(a.startsAt ?? "")))[0];

  return (
    <section aria-label="Live goal status" className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Live goal status</h2>
        {live.length > 0 && <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white">{live.length} live</span>}
      </div>

      {live.length > 0 ? (
        <div className="space-y-3">{live.map((m) => <Scoreboard key={m.id} m={m} />)}</div>
      ) : (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400"><Radio size={20} /></span>
          <p className="mt-3 text-sm font-semibold text-slate-700">No match is live right now</p>
          <p className="mt-1 text-xs text-slate-400">Scores and goals appear here while a match is being played.</p>
          {(next || last) && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-left text-sm">
              {next && (
                <p className="flex items-start gap-2 text-slate-600"><CalendarClock size={16} className="mt-0.5 shrink-0 text-brand" />
                  <span><b className="font-semibold">Next:</b> {next.home} vs {next.away}{matchTime(next) ? <span className="text-slate-400"> · {matchTime(next)}</span> : null}</span></p>
              )}
              {last && (
                <p className="text-slate-600"><b className="font-semibold">Latest result:</b> {last.home} <span className="font-bold text-slate-900">{last.homeScore ?? 0} - {last.awayScore ?? 0}</span> {last.away}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
