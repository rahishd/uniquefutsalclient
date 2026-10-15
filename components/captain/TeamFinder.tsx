"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ChevronRight, Loader2, Search, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { formatHour, formatRs, parseKey } from "@/lib/booking";
import { answerChallenge, findTeams, shareLabel, splitPreview, useTeams, type Challenge, type FoundTeam } from "@/lib/teams";
import ChallengeSheet from "@/components/captain/ChallengeSheet";
import Stars from "@/components/captain/Stars";

const MIN_PLAYERS_TO_INVITE = 5; // the server enforces it too

function when(c: Challenge) {
  const day = parseKey(c.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${formatHour(c.hour)} – ${formatHour(c.hour + 1)}`;
}

// Challenge a team (inside Find Player, captains only): a captain finds another captain (by mobile number or team name) and invites them to a game at a
// chosen court time with a "loser pays" split. The other captain approves or declines. Approving books the court.
export default function TeamFinder({ teamPlayers }: { teamPlayers: number }) {
  const state = useTeams();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<FoundTeam[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const text = q.trim();
  const compact = text.replace(/[\s-]/g, "");
  const ready = /^\d{5,}$/.test(compact) || text.length >= 2;
  const shown = ready ? found : [];

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const t = setTimeout(() => {
      findTeams(text)
        .then((r) => {
          if (!live) return;
          setFound(r);
          setSearchError(null);
        })
        .catch((e) => {
          if (!live) return;
          setFound([]);
          setSearchError(errorText(e));
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, ready]);

  const incoming = (state?.challenges ?? []).filter((c) => c.direction === "in" && c.status === "pending");
  const tooFew = teamPlayers < MIN_PLAYERS_TO_INVITE;

  async function answer(id: string, accept: boolean) {
    setBusy(`${accept ? "a" : "d"}-${id}`);
    setAnswerError(null);
    const r = await answerChallenge(id, accept);
    if (!r.ok) setAnswerError(r.error);
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <section aria-label="Invites waiting for you" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Waiting for your answer ({incoming.length})</h2>
          {incoming.map((c) => {
            const split = splitPreview(c.courtPrice, c.loserPct);
            return (
              <article key={c.id} className="glass rounded-3xl p-4">
                <p className="font-semibold">{c.team.name} invited you</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><CalendarClock size={15} /> {when(c)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {shareLabel(c.loserPct)} · court {formatRs(c.courtPrice)} (loser {formatRs(split.loser)}, winner {formatRs(split.winner)}), paid at the venue
                </p>
                {c.message && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">&ldquo;{c.message}&rdquo;</p>}
                <Link href={`/opponent/team/${c.team.id}`} className="mt-2 block text-xs font-medium text-brand">See their team stats →</Link>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => answer(c.id, false)} className="flex flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 disabled:opacity-60">
                    <X size={15} /> Decline
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => answer(c.id, true)} className="glass-btn flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-60">
                    {busy === `a-${c.id}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve
                  </button>
                </div>
              </article>
            );
          })}
          {answerError && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{answerError}</p>}
        </section>
      )}

      <section aria-label="Find a team" className="space-y-3">
        <label className="block text-sm font-medium">
          Captain&apos;s mobile number or team name
          <span className="relative mt-1 block">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="98XXXXXXXX or team name"
              className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm outline-none"
            />
          </span>
        </label>
        <p className="text-xs text-slate-400">Type at least 5 digits of the number, or 2 letters of the team name.</p>

        {tooFew && (
          <p role="status" className="rounded-xl bg-amber-400/15 px-3 py-2 text-xs text-amber-700">
            Your team needs at least {MIN_PLAYERS_TO_INVITE} players before you can invite. Add players in <Link href="/team" className="font-semibold underline">your team</Link>.
          </p>
        )}
        {searchError && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{searchError}</p>}
        {ready && !searchError && shown.length === 0 && <p className="text-sm text-slate-500">No team found. Check the number or the name.</p>}

        <ul className="space-y-3">
          {shown.map((t) => (
            <li key={t.id} className="glass rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold leading-tight">{t.name}</p>
                  <p className="text-xs text-slate-500">Captain {t.captainName} · {t.players} players · {t.record.wins}W {t.record.draws}D {t.record.losses}L</p>
                </div>
                <Stars rating={t.rating} size={14} />
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/opponent/team/${t.id}`} className="flex flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-medium text-brand">
                  View team stats <ChevronRight size={14} />
                </Link>
                <button type="button" disabled={tooFew} onClick={() => setTarget({ id: t.id, name: t.name })} className="glass-btn flex-1 rounded-full py-2.5 text-xs font-semibold disabled:opacity-50">
                  Invite to play
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>


      {target && <ChallengeSheet target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

