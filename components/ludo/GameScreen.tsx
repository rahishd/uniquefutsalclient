"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Dices, LogOut, Maximize2, Minimize2, Trophy, Wifi, WifiOff } from "lucide-react";
import { errorText } from "@/lib/api";
import { clock, leaveGame, moveToken, rollDice, type LudoEventItem, type LudoGame, type LudoPlayer } from "@/lib/ludo";
import { COLORS, COLOR_NAMES, cellCenter } from "@/lib/ludo-board";
import { ludoSound } from "@/lib/ludo-sound";
import Board from "@/components/ludo/Board";
import { Avatar, BoardDie, Sheet, WinTrophy } from "@/components/ludo/parts";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clone = (t: number[][]) => t.map((r) => [...r]);

function PlayerCard({ p, turn, board, pill = false }: { p: LudoPlayer; turn: boolean; board: LudoGame["board"]; pill?: boolean }) {
  const c = COLORS[p.color];
  const home = board ? board.tokens[p.seat].filter((x) => x === 56).length : 0;
  return (
    <div className={`lu-pcard${turn ? " turn" : ""}`} style={{ ["--ring" as string]: c.main }}>
      <Avatar name={p.name} src={p.avatar} color={p.color} size={40} />
      <div className="min-w-0 flex-1">
        <p className="nm">{p.isMe ? "You" : p.name}</p>
        <p className="sub flex items-center gap-1.5">
          {!p.isBot && <span className={`lu-dot${p.online ? " on" : ""}`} title={p.online ? "Online" : "Offline"} />}
          {p.isBot ? "Computer" : p.botControl ? "Computer is playing" : p.online ? "Online" : "Offline"}
          <span aria-hidden>·</span>{p.captures} capture{p.captures === 1 ? "" : "s"}
        </p>
      </div>
      {pill && turn && board && <span className="lu-turnpill" style={{ ["--c" as string]: c.main, ["--ink" as string]: p.color === "yellow" ? "#231b00" : "#ffffff" }} aria-live="polite">{board.phase === "roll" ? "ROLL" : "MOVE"}</span>}
      <span className="lu-pips" title={`${home} of 4 home`} aria-label={`${home} of 4 tokens home`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < home ? "on" : ""} />)}</span>
    </div>
  );
}

export default function GameScreen({ game, connected, onGame, onError, onRefresh }: { game: LudoGame; connected: boolean; onGame: (g: LudoGame) => void; onError: (m: string) => void; onRefresh: () => void }) {
  const board = game.board!;
  const mySeat = game.mySeat;
  const colors = board.colors;

  // What is drawn on the board lags the server a little so each move can be played back step by step.
  const [shown, setShown] = useState<number[][]>(() => clone(board.tokens));
  const shownSeq = useRef(board.seq);
  const shownRef = useRef<number[][]>(clone(board.tokens));
  const [animating, setAnimating] = useState(false);
  const [dice, setDice] = useState<{ value: number | null; rolling: boolean; seat: number }>({ value: board.dice, rolling: false, seat: board.turn });
  const [hit, setHit] = useState<{ key: string; at: [number, number] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endClosed, setEndClosed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const queue = useRef<LudoGame[]>([]);
  const running = useRef(false);
  const alive = useRef(true);
  const lastGame = useRef(game);

  const set = useCallback((t: number[][]) => { shownRef.current = t; setShown(clone(t)); }, []);

  const play = useCallback(async (g: LudoGame) => {
    const b = g.board!;
    if (b.seq !== shownSeq.current + 1) { set(b.tokens); shownSeq.current = b.seq; return; }
    const tokens = clone(shownRef.current);
    const evs: LudoEventItem[] = g.last;
    for (const e of evs) {
      if (!alive.current) return;
      if (e.type === "roll") {
        setDice({ value: e.value, rolling: true, seat: e.seat });
        ludoSound.dice();
        await wait(650);
        setDice({ value: e.value, rolling: false, seat: e.seat });
        await wait(180);
      } else if (e.type === "move") {
        if (e.from < 0) {
          tokens[e.seat][e.token] = 0; set(tokens); ludoSound.release(); await wait(260);
        } else {
          for (let p = e.from + 1; p <= e.to; p++) { tokens[e.seat][e.token] = p; set(tokens); ludoSound.step(); await wait(150); }
        }
      } else if (e.type === "capture") {
        const at = cellCenter(colors[e.victimSeat], tokens[e.victimSeat][e.victimToken], e.victimToken);
        setHit({ key: `${b.seq}-${e.victimToken}`, at });
        ludoSound.capture();
        if (e.victimSeat === g.mySeat) ludoSound.vibrate([120, 60, 220]); // one of YOUR tokens was eaten
        await wait(380);
        tokens[e.victimSeat][e.victimToken] = -1; set(tokens);
        await wait(250);
      } else if (e.type === "home") {
        ludoSound.home(); await wait(300);
      } else if (e.type === "nomove") {
        await wait(650);
      } else if (e.type === "forfeit") {
        await wait(900);
      }
    }
    set(b.tokens); // always end on exactly what the server says
    shownSeq.current = b.seq;
  }, [colors, set]);

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setAnimating(true);
    try {
      while (queue.current.length && alive.current) {
        if (queue.current.length > 4) { // far behind (a long pause): jump to now
          const latest = queue.current[queue.current.length - 1];
          queue.current = [];
          set(latest.board!.tokens); shownSeq.current = latest.board!.seq;
          break;
        }
        await play(queue.current.shift() as LudoGame);
      }
    } finally {
      running.current = false;
      if (alive.current) setAnimating(false);
    }
  }, [play, set]);

  // a new view of the game from the server (the socket, my own action, or a refresh)
  const lastIn = useRef(board.seq);
  useEffect(() => {
    lastGame.current = game;
    const b = game.board;
    if (!b || b.seq <= lastIn.current) return;
    lastIn.current = b.seq;
    queue.current.push(game);
    void drain();
  }, [game, drain]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  // real full screen of the whole window (desktop button); the game already fills the window
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    ludoSound.button();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const myTurn = game.status === "active" && mySeat !== null && board.turn === mySeat;
  const canAct = myTurn && !animating && !busy;
  const canRoll = canAct && board.phase === "roll";
  const canPick = canAct && board.phase === "move";

  const act = useCallback(async (fn: () => Promise<LudoGame>) => {
    setBusy(true);
    try { onGame(await fn()); }
    catch (e) { onError(errorText(e)); }
    finally { setBusy(false); }
  }, [onGame, onError]);

  const roll = () => { ludoSound.unlock(); void act(() => rollDice(game.id, board.seq)); };
  const pick = (t: number) => { ludoSound.button(); void act(() => moveToken(game.id, t, board.seq)); };

  // only one token can move: just move it (the player already chose by rolling)
  useEffect(() => {
    if (!canPick || board.legal.length !== 1) return;
    const t = setTimeout(() => pick(board.legal[0]), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPick, board.seq]);

  // turn chime
  const prevTurn = useRef(board.turn);
  useEffect(() => {
    if (!animating && myTurn && prevTurn.current !== board.turn) ludoSound.turn();
    if (!animating) prevTurn.current = board.turn;
  }, [animating, myTurn, board.turn]);

  // the end: sound and the +2 flourish once the last move has been played back
  const ended = game.status === "completed" || game.status === "abandoned";
  const showEnd = ended && !animating && !endClosed;
  useEffect(() => {
    if (!showEnd) return;
    if (game.outcome?.youWon) ludoSound.win(); else if (game.status === "completed") ludoSound.lose();
  }, [showEnd, game.outcome?.youWon, game.status]);

  const secondsLeft = game.turnEndsAt ? Math.max(0, Math.ceil((new Date(game.turnEndsAt).getTime() - now) / 1000)) : null;
  const elapsed = game.startedAt ? Math.max(0, Math.floor(((game.finishedAt ? new Date(game.finishedAt).getTime() : now) - new Date(game.startedAt).getTime()) / 1000)) : 0;
  const turnPlayer = game.players.find((p) => p.seat === board.turn);
  const me = game.players.find((p) => p.isMe);
  const others = game.players.filter((p) => !p.isMe);
  const showDice = dice.seat === board.turn || dice.rolling ? dice.value : board.dice;
  const myColor = me ? COLORS[me.color] : COLORS.red;

  const hint = useMemo(() => {
    if (ended) return "Game over";
    if (myTurn) return canRoll ? "Your turn: tap the dice" : canPick ? (board.legal.length > 1 ? "Tap a glowing token to move it" : "Moving…") : "Your turn";
    return `${turnPlayer?.isBot || turnPlayer?.botControl ? (turnPlayer.name.replace(/\s*\(CPU\)/, "") + " (computer)") : turnPlayer?.name ?? "Opponent"} is playing…`;
  }, [ended, myTurn, canRoll, canPick, board.legal.length, turnPlayer]);

  async function doLeave() {
    setLeaveOpen(false);
    try { await leaveGame(game.id); onRefresh(); } catch (e) { onError(errorText(e)); }
  }

  const winner = game.outcome?.winnerSeat != null ? game.players.find((p) => p.seat === game.outcome!.winnerSeat) : null;
  const ranking = game.outcome?.ranking ?? [];

  return (
    <div className="lu-wrap lu-game flex w-full flex-col gap-3 pb-4">
      {/* opponents */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:self-start lg:overflow-visible" aria-label="Players">
        {others.map((p) => (
          <div key={p.id} className="min-w-[13rem] flex-1 lg:min-w-0"><PlayerCard p={p} turn={p.seat === board.turn && game.status === "active"} board={board} pill /></div>
        ))}
        <div className="hidden lg:block">
          <div className="lu-panel mt-2 space-y-2 p-3 text-xs">
            <p className="lu-h2 !mb-1">This game</p>
            <p className="flex justify-between"><span className="lu-muted">Entry fee</span><b>{game.you.fee} point</b></p>
            <p className="flex justify-between"><span className="lu-muted">Winner reward</span><b className="lu-gold">+{game.you.reward} points</b></p>
            <p className="flex justify-between"><span className="lu-muted">Mode</span><b>{game.mode === "solo" ? `Solo (${game.difficulty})` : "With friends"}</b></p>
          </div>
        </div>
      </div>

      {/* board */}
      <div className="lu-boardbox relative mx-auto w-full lg:order-2">
        <div className="overflow-hidden rounded-[1.1rem] ring-1 ring-white/25 shadow-[0_28px_60px_-18px_rgba(0,0,0,0.75)]" style={{ background: "#fbfcff" }}>
          <Board tokens={shown} colors={colors} legal={canPick ? board.legal : []} mySeat={mySeat} onPick={pick} turnSeat={game.status === "active" ? board.turn : null} hitKey={hit?.key} hitAt={hit?.at ?? null} />
        </div>
        {showDice != null && <BoardDie key={`die-${dice.seat}`} value={showDice} rolling={dice.rolling} color={COLORS[COLOR_NAMES[colors[dice.seat] ?? 0]].dark} />}
      </div>

      {/* me: dice and status */}
      <div className="flex flex-col gap-3 lg:order-3 lg:self-start">
        {me && <PlayerCard p={me} turn={myTurn} board={board} />}
        <div className="lu-panel flex items-center gap-4 p-3" style={{ borderColor: myTurn ? myColor.main : undefined }}>
          {myTurn && !ended && <button type="button" onClick={canRoll ? roll : undefined} disabled={!canRoll} aria-label="Roll the dice"
            className={`lu-roll${canRoll ? " ready" : ""}`}
            style={{ ["--c" as string]: myColor.main, ["--cd" as string]: myColor.dark, ["--ink" as string]: me?.color === "yellow" ? "#231b00" : "#ffffff" }}>
            <Dices size={26} strokeWidth={2.4} aria-hidden /> ROLL
          </button>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight" aria-live="polite">{hint}</p>
            <p className="lu-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {secondsLeft !== null && !ended && <span className="flex items-center gap-1"><Clock size={12} /> {secondsLeft}s left</span>}
              <span className="flex items-center gap-1"><Clock size={12} /> {clock(elapsed)}</span>
              {game.mode === "multi" && <span className="flex items-center gap-1" style={{ color: connected ? "var(--lu-good)" : "var(--lu-bad)" }}>{connected ? <Wifi size={12} /> : <WifiOff size={12} />}{connected ? "Connected" : "Reconnecting…"}</span>}
            </p>
            {board.sixes > 0 && myTurn && !ended && <p className="lu-gold mt-1 text-[11px] font-bold">{board.sixes} six{board.sixes > 1 ? "es" : ""} in a row{board.sixes >= 2 ? ": another 6 loses your turn" : ""}</p>}
          </div>
        </div>
        <div className="hidden lg:block"><button type="button" className="lu-btn ghost small block w-full" onClick={toggleFull}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {full ? "Exit full screen" : "Full screen"}</button></div>
        {!ended ? (
          <button type="button" className="lu-btn ghost small" onClick={() => { ludoSound.button(); setLeaveOpen(true); }}><LogOut size={16} /> Leave game</button>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="lu-btn ghost small flex-1" onClick={() => setEndClosed(false)}><Trophy size={16} /> Result</button>
            <Link href="/ludo" className="lu-btn small flex-1">Play again</Link>
          </div>
        )}
        <p className="lu-muted text-center text-[11px] lg:hidden">Entry {game.you.fee} point · Winner +{game.you.reward} points</p>
      </div>

      {leaveOpen && (
        <Sheet title="Leave this game?" onClose={() => setLeaveOpen(false)}>
          <p className="lu-muted mb-4 text-sm">The game has started, so your {game.you.fee} Loyalty Point is not returned and you cannot win it.{game.mode === "multi" ? " The computer plays your seat for the others." : " The game ends."}</p>
          <div className="flex gap-2">
            <button type="button" className="lu-btn ghost block" onClick={() => setLeaveOpen(false)}>Keep playing</button>
            <button type="button" className="lu-btn danger block" onClick={doLeave}>Leave</button>
          </div>
        </Sheet>
      )}

      {showEnd && (
        <Sheet title={game.status === "abandoned" ? "Game ended" : game.outcome?.youWon ? "You won!" : "Game over"} onClose={() => setEndClosed(true)}>
          <div className="text-center">
            {game.outcome?.youWon ? <WinTrophy color={myColor.dark} /> : <Trophy className="lu-pop mx-auto" size={44} style={{ color: "#8c9bc4" }} aria-hidden />}
            {game.status === "abandoned" ? (
              <p className="lu-muted mt-2 text-sm">{game.cancelReason ?? "The game was left."} No one wins and no points are paid out.</p>
            ) : (
              <p className="mt-2 text-lg font-extrabold">{game.outcome?.youWon ? "Congratulations, you beat everyone!" : `${winner?.isMe ? "You" : winner?.name.replace(/\s*\(CPU\)/, "")} won the game`}</p>
            )}
            {game.outcome?.youWon && (
              <p className="lu-rise lu-gold text-2xl font-black" aria-live="polite">+{game.outcome.pointsEarned} Loyalty Points</p>
            )}
          </div>
          {ranking.length > 0 && game.status === "completed" && (
            <ol className="mt-4 space-y-2">
              {ranking.map((seat, i) => {
                const p = game.players.find((x) => x.seat === seat)!;
                return (
                  <li key={seat} className="lu-pcard" style={{ ["--ring" as string]: COLORS[p.color].main }}>
                    <span className="w-5 text-center text-sm font-black">{i + 1}</span>
                    <Avatar name={p.name} src={p.avatar} color={p.color} size={34} />
                    <span className="nm flex-1">{p.isMe ? "You" : p.name}</span>
                    <span className="lu-muted text-xs">{p.captures} captures · {p.home}/4 home</span>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="lu-panel mt-4 grid grid-cols-2 gap-2 p-3 text-center text-xs">
            <p><span className="lu-muted block">Points spent</span><b className="text-base">{game.outcome?.pointsSpent ?? 0}</b></p>
            <p><span className="lu-muted block">Points earned</span><b className="lu-gold text-base">+{game.outcome?.pointsEarned ?? 0}</b></p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/ludo" className="lu-btn block">Play again</Link>
            <Link href="/points" className="lu-btn ghost block">My points</Link>
          </div>
        </Sheet>
      )}
    </div>
  );
}
