"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, Minus, Plus, UserSearch } from "lucide-react";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { dateKey, formatHour } from "@/lib/booking";
import { openSignIn, useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { FALLBACK_RULES, loadRules, playersLabel, postRequest, requestsStore, type PlayerRules } from "@/lib/playerRequests";
import { markReadByTypes } from "@/lib/notifications";
import RequestCard from "@/components/findplayer/RequestCard";
import TeamFinder from "@/components/captain/TeamFinder";

// Find Player: "I need +6 players". The poster picks how many with − / +, the date and the hour; every registered
// player gets a notification and can tap "I'm in" until the spots are full.
export default function FindPlayerPage() {
  const router = useRouter();
  const session = useSession();
  const registered = session?.registered === true;
  const teams = useTeams();
  const { data } = requestsStore.use();
  const [rules, setRules] = useState<PlayerRules>(FALLBACK_RULES);
  const [players, setPlayers] = useState(1);
  const [date, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadRules().then((r) => live && setRules(r)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (registered) markReadByTypes(["players"]); // opening this page clears the "players needed" badge
  }, [registered]);

  // from tomorrow, for the next 6 days (a request cannot be made for today)
  const days = Array.from({ length: rules.windowDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    return { key: dateKey(d), label: i === 0 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) };
  });
  const chosenDate = date ?? days[0].key;
  const hours = rules.hours;
  const chosenHour = hour !== null && hours.includes(hour) ? hour : null;

  const mine = (data ?? []).filter((r) => r.mine);
  const others = (data ?? []).filter((r) => !r.mine);

  async function submit() {
    if (chosenHour === null) return;
    if (!(await askConfirm(`Send "${session?.registered ? session.name : "You"} needs ${playersLabel(players)}" to all registered players?`, { confirmLabel: "Notify everyone", title: "Notify all players?" }))) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await postRequest({ date: chosenDate, hour: chosenHour, players, note: note.trim() || undefined });
      requestsStore.refresh();
      // the host lands on the deal page, which shows how many players have joined so far
      router.push(`/find-player/${id}`);
      return;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-5 pb-32 pt-8 desk:max-w-2xl desk:pb-16">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><UserSearch size={24} className="text-brand" /> Find Player</h1>
        <p className="mt-1 text-sm text-slate-500">Need more players for your game? Say how many. Every registered player is notified and can join.</p>
      </header>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to find players</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : (
        <>
          <section aria-label="Post a request" className="glass space-y-5 rounded-3xl p-5">
            <div>
              <p className="text-sm font-medium">How many players do you need? <span className="font-normal text-slate-400">(up to {rules.maxPlayers})</span></p>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-2">
                <button
                  type="button"
                  aria-label="One less player"
                  disabled={players <= 1}
                  onClick={() => setPlayers((n) => Math.max(1, n - 1))}
                  className="glass-btn flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40"
                >
                  <Minus size={20} />
                </button>
                <p className="text-center" aria-live="polite">
                  <span className="block text-3xl font-bold tabular-nums text-[#0c0b5d]">+{players}</span>
                  <span className="block text-xs font-medium text-slate-500">{players === 1 ? "Player" : "Players"}</span>
                </p>
                <button
                  type="button"
                  aria-label="One more player"
                  disabled={players >= rules.maxPlayers}
                  onClick={() => setPlayers((n) => Math.min(rules.maxPlayers, n + 1))}
                  className="glass-btn flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">Which day? <span className="font-normal text-slate-400">(from tomorrow, {rules.windowDays} days)</span></p>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDate(d.key)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${chosenDate === d.key ? "glass-active" : "border border-slate-200 bg-white text-slate-600"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">What time?</p>
              {hours.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No hours are open for this day. Pick another day.</p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHour(h)}
                      className={`rounded-2xl px-2 py-2.5 text-xs font-medium ${chosenHour === h ? "glass-active" : "border border-slate-200 bg-white text-slate-600"}`}
                    >
                      {formatHour(h)} – {formatHour(h + 1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="block text-sm font-medium">
              Note <span className="font-normal text-slate-400">(optional)</span>
              <input
                value={note}
                maxLength={rules.noteMax}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Friendly game, bring a white shirt"
                className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
              />
            </label>

            <button
              type="button"
              disabled={busy || chosenHour === null}
              onClick={submit}
              className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Notify all players
            </button>
            <p className="-mt-2 text-center text-xs text-slate-400">
              A friendly game: the court price is shared equally, win or lose. Once everyone has joined you pay a Rs. {rules.advanceFee} advance to book the court.
            </p>
            {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
          </section>

          {mine.length > 0 && (
            <section aria-label="Your requests" className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Your requests</h2>
              {mine.map((r) => <RequestCard key={r.id} r={r} />)}
            </section>
          )}

          <section aria-label="Players needed now" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Players needed now</h2>
            {data && others.length === 0 && <p className="glass rounded-3xl p-5 text-center text-sm text-slate-500">No one is looking for players right now.</p>}
            {others.map((r) => <RequestCard key={r.id} r={r} />)}
          </section>

          {teams?.mode === "captain" && teams.team && (
            <details className="glass rounded-3xl p-4">
              <summary className="cursor-pointer text-sm font-semibold">Challenge a team (captains)</summary>
              <div className="mt-4">
                <TeamFinder teamPlayers={teams.team.players} />
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}
