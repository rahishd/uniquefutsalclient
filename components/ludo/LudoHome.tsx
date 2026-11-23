"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Bot, Coins, Loader2, Play, Trophy, Users } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import {
  DEFAULT_RULES, acceptInvite, createRoom, declineInvite, joinByCode, ludoStore, markRulesSeen, resetText, rulesSeen, startSolo,
  useLudoSocket,
} from "@/lib/ludo";
import { ludoSound } from "@/lib/ludo-sound";
import Board from "@/components/ludo/Board";
import { LudoFrame, RulesSheet, Sheet } from "@/components/ludo/parts";
import { GameHistory, LudoStats } from "@/components/ludo/Records";

const PREVIEW = [[-1, 12, 30, 0], [-1, -1, 7, 44], [3, -1, 22, 56], [-1, 18, 52, 38]];

function Meter({ label, used, limit, resets }: { label: string; used: number; limit: number; resets: string }) {
  const full = used >= limit;
  return (
    <div>
      <p className="text-sm font-bold">{label}: {used} / {limit} Games Played Today</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / limit) * 100)}%`, background: full ? "#fb7185" : "#facc15" }} />
      </div>
      {full && <p className="lu-muted mt-1 text-[11px]">Limit reached. You can play again after {resetText(resets)}.</p>}
    </div>
  );
}

export default function LudoHome() {
  const session = useSession();
  const router = useRouter();
  const registered = session?.registered === true;
  const me = ludoStore.use().data ?? null;
  const rules = me?.rules ?? DEFAULT_RULES;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [gate, setGate] = useState<null | (() => void)>(null); // an action waiting for the player to read the rules once
  const [soloOpen, setSoloOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [opp, setOpp] = useState(1);
  const [level, setLevel] = useState<"easy" | "normal" | "hard">("normal");
  const [maxP, setMaxP] = useState(4);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useLudoSocket(() => void ludoStore.refresh(), () => void ludoStore.refresh());
  const lastGameId = me?.recent[0]?.id;
  const soloLeft = me?.limits.solo.left ?? rules.soloLimit;
  const multiLeft = me?.limits.multi.left ?? rules.multiLimit;
  const noPoints = registered && me !== null && me.balance < rules.entryFee;
  const resets = me?.limits.resetsAt ?? "";
  const preview = useMemo(() => PREVIEW, []);

  function guard(action: () => void) {
    ludoSound.unlock();
    if (!registered) return openSignIn();
    if (!rulesSeen()) return setGate(() => action);
    action();
  }
  async function run(key: string, fn: () => Promise<{ code: string } | { id: string; code: string } | { gameId: string; code: string }>) {
    setBusy(key); setMsg(null);
    try {
      const r = await fn();
      void ludoStore.refresh();
      router.push(`/ludo/room/${r.code}`);
    } catch (e) { setMsg(errorText(e)); setBusy(null); }
  }

  return (
    <LudoFrame back={() => router.push("/")} right={<button type="button" className="lu-icon" onClick={() => { ludoSound.button(); setRulesOpen(true); }} aria-label="How to play"><BookOpen size={18} /></button>}>
      <div className="lu-scroll">
        <div className="lu-wrap grid grid-cols-[minmax(0,1fr)] gap-5 pb-8 pt-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
          {/* hero */}
          <section className="mt-10 text-center lg:mt-0 lg:sticky lg:top-0 lg:text-left" aria-label="Unique Ludo">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">UNIQUE <span className="lu-gold">LUDO</span></h2>
            <p className="lu-muted mt-1 text-sm font-semibold uppercase tracking-[0.3em]">Play. Compete. Win.</p>
            <div className="mx-auto mt-4 w-full max-w-[22rem] overflow-hidden rounded-[1.1rem] ring-1 ring-white/25 shadow-[0_28px_60px_-18px_rgba(0,0,0,0.75)] lg:mx-0" aria-hidden>
              <Board tokens={preview} colors={[0, 1, 2, 3]} label="Board preview" />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              <span className="lu-chip"><Coins size={13} /> Entry Fee: {rules.entryFee} Loyalty Point</span>
              <span className="lu-chip gold"><Trophy size={13} /> Winner Reward: +{rules.winReward} Loyalty Points</span>
            </div>
          </section>

          <div className="space-y-4">
            {/* balance */}
            <section className="lu-panel flex items-center justify-between gap-3 p-4" aria-label="Your points">
              <div>
                <p className="lu-h2 !mb-0.5">Your Loyalty Points</p>
                <p className="text-3xl font-black lu-gold" aria-live="polite">{registered ? (me ? me.balance : "…") : "–"}</p>
              </div>
              {registered ? <Link href="/points" className="lu-btn ghost small">My points</Link> : <button type="button" className="lu-btn small" onClick={openSignIn}>Sign in</button>}
            </section>

            {msg && <p role="alert" className="lu-fade rounded-2xl border border-rose-400/50 bg-rose-500/15 px-4 py-3 text-sm font-semibold">{msg}</p>}

            {/* invitations and a game to resume */}
            {me?.invites.map((i) => (
              <section key={i.id} className="lu-panel lu-pop flex flex-wrap items-center gap-3 p-4" style={{ borderColor: "rgba(250,204,21,0.5)" }} aria-label="Invitation">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{i.from} invited you to play</p>
                  <p className="lu-muted text-xs">Room {i.code}</p>
                </div>
                <button type="button" className="lu-btn ghost small" onClick={() => void declineInvite(i.id).then(() => ludoStore.refresh())}>Decline</button>
                <button type="button" className="lu-btn small" disabled={busy !== null} onClick={() => void run("acc" + i.id, () => acceptInvite(i.id))}>Accept</button>
              </section>
            ))}
            {me?.current && (
              <section className="lu-panel flex items-center gap-3 p-4" aria-label="Game in progress">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{me.current.status === "lobby" ? "You are in a room" : "You have a game in progress"}</p>
                  <p className="lu-muted text-xs">Room {me.current.code}</p>
                </div>
                <Link href={`/ludo/room/${me.current.code}`} className="lu-btn small"><Play size={14} /> {me.current.status === "lobby" ? "Open room" : "Resume"}</Link>
              </section>
            )}

            {/* modes */}
            <section className="grid gap-4 sm:grid-cols-2" aria-label="Game modes">
              <div className="lu-panel flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2"><Bot size={20} className="lu-gold" /><h3 className="text-lg font-extrabold">Single Player</h3></div>
                <p className="lu-muted text-sm">Play against 1 to 3 computer opponents. Easy, Normal or Hard.</p>
                {registered && me ? <Meter label="Single Player" used={me.limits.solo.used} limit={me.limits.solo.limit} resets={resets} /> : <p className="text-sm font-bold">Single Player: {rules.soloLimit} games a day</p>}
                <button type="button" className="lu-btn mt-auto block w-full" disabled={registered && (soloLeft <= 0 || noPoints || !!me?.current)} onClick={() => guard(() => setSoloOpen(true))}>PLAY SOLO</button>
              </div>
              <div className="lu-panel flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2"><Users size={20} className="lu-gold" /><h3 className="text-lg font-extrabold">Multiplayer</h3></div>
                <p className="lu-muted text-sm">A private room for 2 to 4 friends, live.{registered && me ? ` ${me.friends.online} of ${me.friends.total} friends online now.` : ""}</p>
                {registered && me ? <Meter label="Multiplayer" used={me.limits.multi.used} limit={me.limits.multi.limit} resets={resets} /> : <p className="text-sm font-bold">Multiplayer: {rules.multiLimit} games a day</p>}
                <button type="button" className="lu-btn mt-auto block w-full" disabled={registered && (multiLeft <= 0 || noPoints || !!me?.current)} onClick={() => guard(() => setRoomOpen(true))}>PLAY WITH FRIENDS</button>
              </div>
            </section>
            {noPoints && (
              <p role="status" className="rounded-2xl border px-4 py-3 text-center" style={{ borderColor: "rgba(251,113,133,0.45)", background: "rgba(251,113,133,0.12)", color: "var(--lu-bad)" }}>
                <span className="block text-sm font-extrabold">You need {rules.entryFee} Loyalty Point to play.</span>
                <span className="mt-0.5 block text-xs font-semibold">Earn points by booking games, then come back.</span>
              </p>
            )}

            {registered && (
              <form className="lu-panel flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (code.trim().length === 6) guard(() => void run("join", () => joinByCode(code.trim().toUpperCase()))); }}>
                <input className="lu-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="Room code (invited friends)" aria-label="Room code" autoCapitalize="characters" inputMode="text" />
                <button type="submit" className="lu-btn small" disabled={code.length !== 6 || busy !== null}>Join</button>
              </form>
            )}

            {/* the player's records (also under Profile > Unique Ludo Game) */}
            {registered && me && me.stats.played > 0 && <LudoStats stats={me.stats} />}
            {registered && <GameHistory refreshKey={lastGameId} />}
            {registered && (
              <Link href="/profile/ludo#leaderboard" className="lu-btn ghost block w-full text-center" onClick={() => ludoSound.button()}>
                <Trophy size={16} /> View Leaderboard
              </Link>
            )}
          </div>
        </div>
      </div>

      {soloOpen && (
        <Sheet title="Single Player" onClose={() => setSoloOpen(false)}>
          <p className="lu-h2">Opponents (computer)</p>
          <div className="lu-seg" role="group" aria-label="Number of opponents">
            {[1, 2, 3].map((n) => <button key={n} type="button" aria-pressed={opp === n} onClick={() => setOpp(n)}>{n} ({n + 1} players)</button>)}
          </div>
          <p className="lu-h2 mt-4">Difficulty</p>
          <div className="lu-seg" role="group" aria-label="Difficulty">
            {(["easy", "normal", "hard"] as const).map((d) => <button key={d} type="button" aria-pressed={level === d} onClick={() => setLevel(d)} style={{ textTransform: "capitalize" }}>{d}</button>)}
          </div>
          <p className="lu-muted mt-3 text-xs">Computer players follow exactly the same rules as you and cannot change the dice.</p>
          <div className="lu-panel mt-4 flex items-center justify-between p-3 text-sm"><span>Entry fee</span><b>{rules.entryFee} Loyalty Point</b></div>
          <div className="lu-panel mt-2 flex items-center justify-between p-3 text-sm"><span>Winner reward</span><b className="lu-gold">+{rules.winReward} Loyalty Points</b></div>
          <p className="lu-muted mt-2 text-center text-xs">{soloLeft} of {rules.soloLimit} single player games left today. The fee is taken when the game starts.</p>
          <button type="button" className="lu-btn mt-4 block w-full" disabled={busy !== null} onClick={() => void run("solo", () => startSolo(opp, level)).then(() => setBusy(null))}>
            {busy === "solo" ? <Loader2 size={18} className="lu-spin" /> : <Play size={18} />} Start game
          </button>
          {msg && <p role="alert" className="mt-3 text-center text-sm font-semibold text-rose-300">{msg}</p>}
        </Sheet>
      )}

      {roomOpen && (
        <Sheet title="Play with friends" onClose={() => setRoomOpen(false)}>
          <p className="lu-h2">Players in the room</p>
          <div className="lu-seg" role="group" aria-label="Players">
            {[2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={maxP === n} onClick={() => setMaxP(n)}>{n} players</button>)}
          </div>
          <p className="lu-muted mt-3 text-xs">You create a private room, then invite friends from your friend list. Nobody pays until you press Start game.</p>
          <p className="lu-muted mt-2 text-center text-xs">{multiLeft} of {rules.multiLimit} multiplayer games left today.</p>
          <button type="button" className="lu-btn mt-4 block w-full" disabled={busy !== null} onClick={() => void run("room", () => createRoom(maxP)).then(() => setBusy(null))}>
            {busy === "room" ? <Loader2 size={18} className="lu-spin" /> : <Users size={18} />} Create room
          </button>
          {msg && <p role="alert" className="mt-3 text-center text-sm font-semibold text-rose-300">{msg}</p>}
        </Sheet>
      )}

      {rulesOpen && <RulesSheet onClose={() => setRulesOpen(false)} rules={rules} />}
      {gate && <RulesSheet rules={rules} onClose={() => setGate(null)} onContinue={() => { markRulesSeen(); const a = gate; setGate(null); a(); }} />}
    </LudoFrame>
  );
}
