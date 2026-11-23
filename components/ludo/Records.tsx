"use client";

import { useEffect, useState } from "react";
import { clock, fetchHistory, fetchLeaderboard, type HistoryRow, type LeaderRow, type Stats } from "@/lib/ludo";

// A player's Unique Ludo records: totals, finished games and the leaderboard. Used on the game's own screen (components/ludo/LudoHome.tsx)
// and on Profile > Unique Ludo Game (app/profile/ludo), so the two always show the same thing.

const RESULT: Record<string, string> = { won: "Won", lost: "Lost", left: "Left", cancelled: "Cancelled" };

export function LudoStats({ stats }: { stats: Stats }) {
  return (
    <section className="lu-panel p-4" aria-label="Your statistics">
      <p className="lu-h2">Your statistics</p>
      <dl className="grid grid-cols-3 gap-3 text-center sm:grid-cols-4">
        {[["Games", stats.played], ["Wins", stats.wins], ["Losses", stats.losses], ["Win rate", `${stats.winRate}%`], ["Captures", stats.captures], ["With friends", stats.vsFriends], ["Best streak", stats.bestStreak]].map(([k, v]) => (
          <div key={String(k)}><dd className="text-xl font-black">{v}</dd><dt className="lu-muted text-[10px] font-bold uppercase tracking-wider">{k}</dt></div>
        ))}
      </dl>
    </section>
  );
}

/** Finished games, newest first. `pageSize` rows at first; with `paged`, a "Show more" button loads the next ones. `refreshKey` reloads when a game ends. */
export function GameHistory({ pageSize = 20, paged = false, refreshKey }: { pageSize?: number; paged?: boolean; refreshKey?: string }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [more, setMore] = useState(false); // there may be older games
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    void fetchHistory(pageSize, 0)
      .then((r) => { if (on) { setRows(r); setMore(r.length === pageSize); } })
      .catch(() => { if (on) { setRows([]); setMore(false); } });
    return () => { on = false; };
  }, [pageSize, refreshKey]);

  async function loadMore() {
    if (!rows || busy) return;
    setBusy(true);
    try {
      const next = await fetchHistory(pageSize, rows.length);
      setRows([...rows, ...next]);
      setMore(next.length === pageSize);
    } catch { setMore(false); } finally { setBusy(false); }
  }

  return (
    <section className="lu-panel p-4" aria-label="Game history">
      <p className="lu-h2">Game history</p>
      {rows === null ? <p className="lu-muted lu-wait text-sm">Loading…</p> : rows.length === 0 ? <p className="lu-muted text-sm">No games yet. Your finished games will show here.</p> : (
        <div className="overflow-x-auto">
          <table className="lu-table">
            <thead><tr><th>Game</th><th>Result</th><th>Opponents</th><th>Points</th><th>Time</th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td><b>{h.mode === "solo" ? "Solo" : "Friends"}</b><br /><span className="lu-muted text-[11px]">{h.code} · {new Date(h.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" })}</span></td>
                  <td><span className={`lu-chip ${h.result === "won" ? "good" : h.result === "lost" ? "bad" : ""}`}>{RESULT[h.result] ?? "Ended"}</span></td>
                  <td className="max-w-[9rem] text-[12px]">{h.opponents.join(", ") || "–"}</td>
                  <td className="whitespace-nowrap text-[12px]">−{h.pointsSpent}{h.refunded ? " (refunded)" : ""}{h.pointsEarned ? <b className="lu-gold"> +{h.pointsEarned}</b> : ""}</td>
                  <td className="whitespace-nowrap text-[12px]">{h.durationSec ? clock(h.durationSec) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paged && more && <button type="button" className="lu-btn ghost small mt-3 block w-full" disabled={busy} onClick={() => void loadMore()}>{busy ? "Loading…" : "Show older games"}</button>}
    </section>
  );
}

export function LudoLeaderboard() {
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [sort, setSort] = useState<"wins" | "rate" | "played">("wins");
  const [mode, setMode] = useState<"multi" | "solo">("multi");
  const [data, setData] = useState<{ key: string; rows: LeaderRow[] } | null>(null);
  const key = `${period}|${sort}|${mode}`;
  const board = data?.key === key ? data.rows : null;

  useEffect(() => {
    let on = true;
    void fetchLeaderboard(period, sort, mode).then((r) => on && setData({ key, rows: r.rows })).catch(() => on && setData({ key, rows: [] }));
    return () => { on = false; };
  }, [period, sort, mode, key]);

  return (
    <section id="leaderboard" className="lu-panel scroll-mt-4 p-4" aria-label="Leaderboard">
      <div className="mb-2 flex items-center justify-between gap-2"><p className="lu-h2 !mb-0">Leaderboard</p></div>
      <div className="flex flex-wrap gap-2">
        <div className="lu-seg min-w-[11rem] flex-1" role="group" aria-label="Period">{(["month", "all"] as const).map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{p === "month" ? "This month" : "All time"}</button>)}</div>
        <div className="lu-seg min-w-[11rem] flex-1" role="group" aria-label="Sort by">{([["wins", "Wins"], ["rate", "Win %"], ["played", "Played"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}</div>
        <div className="lu-seg min-w-[11rem] flex-1" role="group" aria-label="Mode">{([["multi", "Friends"], ["solo", "Computer"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div>
      </div>
      {board === null ? <p className="lu-muted lu-wait mt-3 text-sm">Loading…</p> : board.length === 0 ? <p className="lu-muted mt-3 text-sm">No games to rank yet.{sort === "rate" ? " Win % needs at least 5 finished games." : ""}</p> : (
        <ol className="mt-3 space-y-1.5">
          {board.map((r) => (
            <li key={r.rank} className="lu-pcard"><span className="w-6 text-center font-black lu-gold">{r.rank}</span><span className="nm flex-1">{r.name}</span><span className="lu-muted text-xs">{r.wins} wins · {r.played} played · {r.winRate}%</span></li>
          ))}
        </ol>
      )}
    </section>
  );
}
