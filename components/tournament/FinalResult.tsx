import { Trophy } from "lucide-react";
import type { TieMatch, TieRound } from "@/lib/tournament";

// A finished tournament: the final (its winner and the score), then every finished match with its winner and score.
// Nothing shows until at least one match has a result.
const score = (n: number | null) => (n === null ? 0 : n);
const winnerOf = (m: TieMatch): "home" | "away" | null => {
  if (m.homeScore === null || m.awayScore === null || m.homeScore === m.awayScore) return null;
  return m.homeScore > m.awayScore ? "home" : "away";
};

export default function FinalResult({ rounds }: { rounds: TieRound[] }) {
  const done = rounds.map((r) => ({ ...r, matches: r.matches.filter((m) => m.status === "finished" && m.home && m.away) })).filter((r) => r.matches.length > 0);
  if (done.length === 0) return null;
  const finalRound = done[done.length - 1];
  const final = finalRound.matches[finalRound.matches.length - 1];
  const w = winnerOf(final);
  const champion = w === "home" ? final.home : w === "away" ? final.away : null;
  const runnerUp = w === "home" ? final.away : w === "away" ? final.home : null;

  return (
    <section aria-label="Final result" className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-slate-900">Final result</h2>
      <div className="glass rounded-3xl p-5 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-400/20 text-amber-600"><Trophy size={24} aria-hidden /></span>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{/final/i.test(finalRound.name) ? finalRound.name : `${finalRound.name} · Final`}</p>
        {champion ? <p className="mt-1 text-xl font-extrabold text-slate-900">{champion}</p> : <p className="mt-1 text-base font-semibold text-slate-700">Level after full time</p>}
        {champion && <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Winner</p>}
        <p className="mx-auto mt-3 inline-block rounded-2xl bg-[#0c0b5d] px-5 py-2 text-2xl font-extrabold tabular-nums text-white" aria-label={`Final score ${score(final.homeScore)} to ${score(final.awayScore)}`}>
          {score(final.homeScore)} <span className="text-white/50">–</span> {score(final.awayScore)}
        </p>
        <p className="mt-2 text-sm text-slate-500">{final.home} vs {final.away}{final.note ? ` · ${final.note}` : ""}</p>
        {runnerUp && <p className="mt-1 text-xs text-slate-400">Runner-up: {runnerUp}</p>}
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">All results</h3>
      <div className="space-y-4">
        {done.map((r) => (
          <div key={r.id}>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">{r.name}</p>
            <ul className="glass divide-y divide-white/60 rounded-2xl text-sm">
              {r.matches.map((m) => {
                const mw = winnerOf(m);
                return (
                  <li key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
                    <span className={`truncate text-right ${mw === "home" ? "font-bold text-slate-900" : "text-slate-500"}`}>{m.home}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold tabular-nums text-[#0c0b5d]">{score(m.homeScore)} – {score(m.awayScore)}</span>
                    <span className={`truncate ${mw === "away" ? "font-bold text-slate-900" : "text-slate-500"}`}>{m.away}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
