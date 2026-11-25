"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Bot, Coins, Loader2, LogOut, Play, Trophy, Users } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import {
  DEFAULT_RULES, acceptInvite, createRoom, declineInvite, joinByCode, leaveGame, ludoStore, markRulesSeen, resetText, rulesSeen, startSolo,
  useLudoSocket,
} from "@/lib/ludo";
import { ludoSound } from "@/lib/ludo-sound";
import Board from "@/components/ludo/Board";
import { LudoFrame, RulesSheet, Sheet } from "@/components/ludo/parts";

const PREVIEW = [[-1, 12, 30, 0], [-1, -1, 7, 44], [3, -1, 22, 56], [-1, 18, 52, 38]];

function Meter({ label, used, limit, resets }: { label: string; used: number; limit: number; resets: string }) {
  const full = used >= limit;
  return (
    <div className="lu-panel min-w-0 px-2.5 py-2">
      <p className="text-xs font-extrabold leading-tight">{label}</p>
      <p className="lu-muted text-[10px] font-semibold leading-tight">{used} / {limit} Games Played Today</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / limit) * 100)}%`, background: full ? "#fb7185" : "#facc15" }} />
      </div>
      {full && <p className="lu-muted mt-1 text-[10px] leading-tight">Play again after {resetText(resets)}</p>}
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
  const [leaveOpen, setLeaveOpen] = useState(false);

  useLudoSocket(() => void ludoStore.refresh(), () => void ludoStore.refresh());
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
  async function leaveCurrent() {
    const id = me?.current?.id;
    if (!id) return;
    setBusy("leave"); setMsg(null);
    try { await leaveGame(id); await ludoStore.refresh(); setLeaveOpen(false); }
    catch (e) { setMsg(errorText(e)); }
    finally { setBusy(null); }
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
        <div className="lu-wrap flex flex-col gap-3 pb-4 pt-1 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pb-8">
          {me?.current && (
            <section className="lu-live lg:col-span-2" aria-label="Game in progress">
              <div className="flex items-center gap-3">
                <span className="lu-livedot" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-extrabold leading-tight">{me.current.status === "lobby" ? "You are in a room" : "You have a game in progress"}</p>
                  <p className="lu-muted text-xs">Room <b className="font-mono tracking-widest text-white">{me.current.code}</b></p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Link href={`/ludo/room/${me.current.code}`} className="lu-btn" onClick={() => ludoSound.button()}><Play size={16} /> {me.current.status === "lobby" ? "Open room" : "Resume game"}</Link>
                <button type="button" className="lu-btn danger" onClick={() => { ludoSound.button(); setMsg(null); setLeaveOpen(true); }}><LogOut size={16} /> Leave</button>
              </div>
            </section>
          )}
          {/* title and the board */}
          <section className="text-center lg:sticky lg:top-0 lg:text-left" aria-label="Unique Ludo">
            <h2 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">UNIQUE<span className="lu-gold ml-[0.3em]">LUDO</span></h2>
            <p className="lu-muted mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] sm:text-sm">Play. Compete. Win.</p>
            <div className="mx-auto mt-3 w-full overflow-hidden rounded-[1rem] ring-1 ring-white/25 shadow-[0_24px_50px_-18px_rgba(0,0,0,0.75)] lg:mx-0" style={{ maxWidth: "min(100%, 22rem, calc(100dvh - 27rem))", minWidth: "min(100%, 14rem)" }} aria-hidden>
              <Board tokens={preview} colors={[0, 1, 2, 3]} label="Board preview" />
            </div>
            <div className="mt-3 flex justify-center gap-2 lg:justify-start">
              <span className="lu-chip"><Coins size={12} /> <span className="sm:hidden">Entry {rules.entryFee} point</span><span className="hidden sm:inline">Entry Fee: {rules.entryFee} Loyalty Point</span></span>
              <span className="lu-chip gold"><Trophy size={12} /> <span className="sm:hidden">Win +{rules.winReward} points</span><span className="hidden sm:inline">Winner Reward: +{rules.winReward} Loyalty Points</span></span>
            </div>
          </section>

          <div className="flex flex-col gap-2">
            {/* Single Player and Multiplayer, side by side */}
            <section className="grid grid-cols-2 gap-2" aria-label="Game modes">
              <button type="button" className="lu-btn !min-h-[3.1rem] !px-2 !text-[0.8rem] sm:!text-[0.9rem]" disabled={registered && (soloLeft <= 0 || noPoints || !!me?.current)} onClick={() => guard(() => setSoloOpen(true))}>
                <Bot size={17} className="shrink-0" aria-hidden /> PLAY SOLO
              </button>
              <button type="button" className="lu-btn !min-h-[3.1rem] !px-2 !text-[0.8rem] sm:!text-[0.9rem]" disabled={registered && (multiLeft <= 0 || noPoints || !!me?.current)} onClick={() => guard(() => setRoomOpen(true))}>
                <Users size={17} className="shrink-0" aria-hidden /> <span className="sm:hidden">WITH FRIENDS</span><span className="hidden sm:inline">PLAY WITH FRIENDS</span>
              </button>
            </section>

            {/* the balance */}
            <section className="lu-panel flex items-center justify-between gap-3 px-3.5 py-1.5" aria-label="Your points">
              <div>
                <p className="lu-h2 !mb-0">Your Loyalty Points</p>
                <p className="text-xl font-black leading-none lu-gold" aria-live="polite">{registered ? (me ? me.balance : "…") : "–"}</p>
              </div>
              {registered ? <Link href="/points" className="lu-btn ghost small">My points</Link> : <button type="button" className="lu-btn small" onClick={openSignIn}>Sign in</button>}
            </section>

            {/* games played today, per mode */}
            <section className="grid grid-cols-2 gap-2" aria-label="Games played today">
              {registered && me ? (
                <>
                  <Meter label="Single Player" used={me.limits.solo.used} limit={me.limits.solo.limit} resets={resets} />
                  <Meter label="Multiplayer" used={me.limits.multi.used} limit={me.limits.multi.limit} resets={resets} />
                </>
              ) : (
                <>
                  <div className="lu-panel px-2.5 py-2"><p className="text-xs font-extrabold">Single Player</p><p className="lu-muted text-[10px] font-semibold">{rules.soloLimit} games a day</p></div>
                  <div className="lu-panel px-2.5 py-2"><p className="text-xs font-extrabold">Multiplayer</p><p className="lu-muted text-[10px] font-semibold">{rules.multiLimit} games a day</p></div>
                </>
              )}
            </section>

            {noPoints && (
              <p role="status" className="rounded-2xl border px-4 py-2 text-center" style={{ borderColor: "rgba(251,113,133,0.45)", background: "rgba(251,113,133,0.12)", color: "var(--lu-bad)" }}>
                <span className="block text-sm font-extrabold">You need {rules.entryFee} Loyalty Point to play.</span>
                <span className="mt-0.5 block text-xs font-semibold">Earn points by booking games, then come back.</span>
              </p>
            )}
            {msg && <p role="alert" className="lu-fade rounded-2xl border border-rose-400/50 bg-rose-500/15 px-4 py-2 text-sm font-semibold">{msg}</p>}

            {/* invitations and a game to resume (only when there is one) */}
            {me?.invites.map((i) => (
              <section key={i.id} className="lu-panel lu-pop flex flex-wrap items-center gap-3 p-3" style={{ borderColor: "rgba(250,204,21,0.5)" }} aria-label="Invitation">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{i.from} invited you to play</p>
                  <p className="lu-muted text-xs">Room {i.code}</p>
                </div>
                <button type="button" className="lu-btn ghost small" onClick={() => void declineInvite(i.id).then(() => ludoStore.refresh())}>Decline</button>
                <button type="button" className="lu-btn small" disabled={busy !== null} onClick={() => void run("acc" + i.id, () => acceptInvite(i.id))}>Accept</button>
              </section>
            ))}
            {/* the records (statistics, history and the leaderboard are under Profile > Unique Ludo Game) */}
            {registered && (
              <Link href="/profile/ludo" className="lu-btn ghost small w-full" onClick={() => ludoSound.button()} aria-label="View Records and Leaderboard">
                <Trophy size={15} /> Records &amp; Leaderboard
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
        <Sheet title="Play with friends" half onClose={() => setRoomOpen(false)}>
          <div className="lu-seg" role="group" aria-label="Players in the room">
            {[2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={maxP === n} onClick={() => setMaxP(n)}>{n} players</button>)}
          </div>
          <p className="lu-muted mt-2.5 text-center text-xs leading-snug">Create a private room and invite friends. Nobody pays until you press Start game. {multiLeft} of {rules.multiLimit} games left today.</p>
          <button type="button" className="lu-btn mt-3 block w-full" disabled={busy !== null} onClick={() => void run("room", () => createRoom(maxP)).then(() => setBusy(null))}>
            {busy === "room" ? <Loader2 size={18} className="lu-spin" /> : <Users size={18} />} Create room
          </button>
          <div className="lu-or" role="separator"><span>or join with a code</span></div>
          <form className="lu-joinrow" onSubmit={(e) => { e.preventDefault(); if (code.trim().length === 6) void run("join", () => joinByCode(code.trim().toUpperCase())).then(() => setBusy(null)); }}>
            <input className="lu-input lu-code min-w-0 flex-1" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ROOM CODE" aria-label="Room code (invited friends)" autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" maxLength={6} />
            <button type="submit" className={`lu-btn lu-joinbtn${code.length === 6 ? "" : " idle"}`} disabled={code.length !== 6 || busy !== null}>{busy === "join" ? <Loader2 size={16} className="lu-spin" /> : "Join"}</button>
          </form>
          {msg && <p role="alert" className="mt-3 text-center text-sm font-semibold text-rose-300">{msg}</p>}
        </Sheet>
      )}

      {leaveOpen && me?.current && (
        <Sheet title={me.current.status === "lobby" ? "Leave this room?" : "Leave this game?"} half onClose={() => setLeaveOpen(false)}>
          <p className="lu-muted mb-4 text-sm">
            {me.current.status === "lobby"
              ? "Nobody has been charged yet. If you created the room it closes for everyone; otherwise you simply leave it."
              : `The game has started, so your ${rules.entryFee} Loyalty Point is not returned and you cannot win it.${me.current.mode === "multi" ? " The computer plays your seat for the others." : " The game ends."}`}
          </p>
          {msg && <p role="alert" className="mb-3 text-center text-sm font-semibold text-rose-300">{msg}</p>}
          <div className="flex gap-2">
            <button type="button" className="lu-btn ghost block" onClick={() => setLeaveOpen(false)}>Keep playing</button>
            <button type="button" className="lu-btn danger block" disabled={busy !== null} onClick={() => void leaveCurrent()}>{busy === "leave" ? <Loader2 size={16} className="lu-spin" /> : <LogOut size={16} />} Leave</button>
          </div>
        </Sheet>
      )}

      {rulesOpen && <RulesSheet onClose={() => setRulesOpen(false)} rules={rules} />}
      {gate && <RulesSheet rules={rules} onClose={() => setGate(null)} onContinue={() => { markRulesSeen(); const a = gate; setGate(null); a(); }} />}
    </LudoFrame>
  );
}
