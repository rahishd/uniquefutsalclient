"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarDays, Crosshair, Gauge, Goal, Loader2, Play, RotateCcw, Star, Trophy, Volume2, VolumeX } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { resolveShot, type ShotInput, type ShotResult } from "@/lib/goalrush-sim";
import { sfx } from "@/lib/goalrush-sound";
import {
  OUTCOME_TEXT, RULES, goalRushStore, pts, markTutorialSeen, readMuted, saveMuted, sendShot, startGame, tutorialSeen,
  type GRGame, type GRShot,
} from "@/lib/goalrush";
import { loyaltyStore } from "@/lib/loyalty";
import PenaltyGame, { type PenaltyGameHandle } from "@/components/goalrush/PenaltyGame";

const noop = () => () => {};
const PIP: Record<GRShot["outcome"], string> = { goal: "bg-emerald-500 text-white", save: "bg-amber-500 text-white", wide: "bg-slate-500 text-white", over: "bg-slate-500 text-white", post: "bg-rose-500 text-white" };
const PIP_ICON: Record<GRShot["outcome"], string> = { goal: "✓", save: "✕", wide: "–", over: "–", post: "|" };

type Mode = "idle" | "reward" | "practice";

function Pips({ shots }: { shots: GRShot[] }) {
  return (
    <ol className="flex shrink-0 items-center gap-1" aria-label="Shots">
      {Array.from({ length: RULES.shotsPerGame }, (_, i) => {
        const s = shots[i];
        return (
          <li key={i} aria-label={s ? `Shot ${i + 1}: ${OUTCOME_TEXT[s.outcome]}` : `Shot ${i + 1}: to come`}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold desk:h-6 desk:w-6 desk:text-[11px] ${s ? PIP[s.outcome] : "border-2 border-white/40 text-white/50"}`}>
            {s ? PIP_ICON[s.outcome] : i + 1}
          </li>
        );
      })}
    </ol>
  );
}

// Unique Goal Rush: Play. Score. Earn. A 5-shot penalty game; a finished game with a goal earns 2 loyalty points.
export default function GoalRushPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const me = goalRushStore.use().data ?? null;
  const loyalty = loyaltyStore.use().data;

  const storedMuted = useSyncExternalStore(noop, readMuted, () => false);
  const [mutedChoice, setMutedChoice] = useState<boolean | null>(null);
  const muted = mutedChoice ?? storedMuted;
  const seen = useSyncExternalStore(noop, tutorialSeen, () => true);
  const [tutorialDone, setTutorialDone] = useState(false);

  const [mode, setMode] = useState<Mode>("idle");
  const [game, setGame] = useState<GRGame | null>(null); // a points game, as last shown on screen
  const [practice, setPractice] = useState<GRShot[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const pending = useRef<GRGame | null>(null); // the server's answer, shown once the kick has been played back
  const gameRef = useRef<PenaltyGameHandle>(null);

  const shots: GRShot[] = mode === "reward" ? game?.shots ?? [] : mode === "practice" ? practice : [];
  const goals = shots.filter((s) => s.outcome === "goal").length;
  const finished = shots.length >= RULES.shotsPerGame;
  const allowance = me?.allowance;
  const left = allowance?.left ?? RULES.gamesPerDay;
  const active = me?.active ?? null;
  const showTutorial = mode !== "idle" && !seen && !tutorialDone && shots.length === 0;
  const canShoot = mode !== "idle" && !finished && !showTutorial;

  function toggleMute() {
    const next = !muted;
    setMutedChoice(next);
    saveMuted(next);
    if (!next) sfx.unlock();
  }

  async function playForPoints() {
    if (!registered) return openSignIn();
    setBusy(true);
    setMessage(null);
    try {
      const r = await startGame();
      pending.current = r.game;
      setGame(r.game);
      setMode("reward");
      if (!muted) sfx.whistle();
      goalRushStore.refresh();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function playPractice() {
    setMessage(null);
    setPractice([]);
    setMode("practice");
    if (!muted) sfx.whistle();
  }

  async function onShoot(input: ShotInput): Promise<ShotResult> {
    setMessage(null);
    if (mode === "practice") {
      await new Promise((r) => setTimeout(r, 120));
      return resolveShot(input, Math.random, 2);
    }
    if (!game) throw new Error("Start a game first");
    const r = await sendShot(game.id, game.shots.length + 1, input);
    pending.current = r.game;
    return { outcome: r.shot.outcome, ballX: r.shot.ballX, ballY: r.shot.ballY, keeper: r.shot.keeper };
  }

  function onResolved(r: ShotResult) {
    setAnnounce(`${OUTCOME_TEXT[r.outcome]}!`);
    if (mode === "practice") {
      setPractice((p) => [...p, { no: p.length + 1, outcome: r.outcome, ballX: r.ballX, ballY: r.ballY, keeper: r.keeper, aimX: 0, aimY: 0, power: 0 }]);
      return;
    }
    const g = pending.current;
    if (g) {
      setGame(g);
      if (g.status !== "active") {
        if (!muted) sfx.whistle();
        goalRushStore.refresh();
        loyaltyStore.refresh();
      }
    }
  }

  const toCome = mode === "idle" ? "" : `Shot ${Math.min(shots.length + 1, RULES.shotsPerGame)} of ${RULES.shotsPerGame}`;

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 pb-32 pt-6 desk:max-w-5xl desk:pb-16">
      {/* heading, in the brand's light-blue style */}
      <section className="overflow-hidden rounded-3xl border border-[#d6e4fb] p-5 desk:p-8" style={{ background: "linear-gradient(180deg,#f5f9ff 0%,#e3eeff 100%)" }}>
        <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-[#0c0b5d]">Mini game · Loyalty points</span>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-[#0c0b5d] desk:text-4xl"><Goal size={26} aria-hidden /> Unique Goal Rush</h1>
        <p className="mt-0.5 text-base font-medium text-slate-600 desk:text-lg">Play &amp; Earn · Play. Score. Earn.</p>
        <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          {[`${RULES.shotsPerGame} penalties a game`, `${RULES.goalsToQualify} goals = +${RULES.pointsPerGame} point`, `${RULES.gamesPerDay} games a day`].map((t) => (
            <li key={t} className="rounded-full border border-[#d6e4fb] bg-white px-3 py-1.5 text-[#0c0b5d]">{t}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 desk:grid-cols-[minmax(0,1fr)_340px]">
        {/* the game */}
        <section aria-label="Penalty game" className="space-y-3">
          <div className="uf-keep flex items-center justify-between gap-2 rounded-2xl px-3 py-3 desk:gap-3 desk:px-4" style={{ background: "#030a1f", color: "#ffffff" }}>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>{mode === "practice" ? "Practice · no points" : mode === "reward" ? "Playing for points" : "Ready"}</p>
              <p className="whitespace-nowrap text-base font-black desk:text-lg" style={{ color: "#ffffff" }}>{goals} Goal{goals === 1 ? "" : "s"} / {shots.length} Shot{shots.length === 1 ? "" : "s"}</p>
            </div>
            <Pips shots={shots} />
            <button type="button" onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff" }}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          <div className="relative">
            <PenaltyGame
              key={mode === "reward" ? game?.id ?? "r" : mode}
              ref={gameRef}
              enabled={canShoot}
              muted={muted}
              onShoot={onShoot}
              onResolved={onResolved}
              onError={(m) => setMessage(m)}
              caption={toCome || "Not started"}
            />

            {/* start screen */}
            {mode === "idle" && (
              <div className="uf-keep absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center" style={{ background: "rgba(3,10,31,0.72)", color: "#ffffff" }}>
                <Trophy size={40} style={{ color: "#facc15" }} aria-hidden />
                <p className="text-2xl font-black italic" style={{ color: "#ffffff" }}>Beat the keeper</p>
                <p className="max-w-xs text-sm" style={{ color: "#cbd5e1" }}>Five penalties. Score {RULES.goalsToQualify} or more and win {pts(RULES.pointsPerGame)}.</p>
                {!registered ? (
                  <>
                    <button type="button" onClick={playPractice} className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold" style={{ background: "#facc15", color: "#0c0b5d" }}><Play size={16} /> Play practice</button>
                    <button type="button" onClick={openSignIn} className="text-sm font-semibold underline" style={{ color: "#86efac" }}>Register or sign in to earn points</button>
                  </>
                ) : active ? (
                  <button type="button" disabled={busy} onClick={playForPoints} className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold disabled:opacity-60" style={{ background: "#facc15", color: "#0c0b5d" }}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Resume your game (shot {active.shotsTaken + 1} of {RULES.shotsPerGame})
                  </button>
                ) : left > 0 ? (
                  <button type="button" disabled={busy || !me} onClick={playForPoints} className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold disabled:opacity-60" style={{ background: "#facc15", color: "#0c0b5d" }}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Play &amp; Earn Now
                  </button>
                ) : (
                  <>
                    <p className="text-sm font-semibold" style={{ color: "#fde68a" }}>You have played your {RULES.gamesPerDay} games today. New games tomorrow.</p>
                    <button type="button" onClick={playPractice} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold" style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff" }}><Play size={16} /> Practice (no points)</button>
                  </>
                )}
                {registered && allowance && <p className="text-xs" style={{ color: "#94a3b8" }}>Games Played Today: {allowance.used}/{allowance.limit}</p>}
              </div>
            )}

            {/* first-time tutorial */}
            {showTutorial && (
              <div className="uf-keep absolute inset-0 flex flex-col justify-center gap-3 rounded-3xl p-6" style={{ background: "rgba(3,10,31,0.85)", color: "#ffffff" }}>
                <p className="text-center text-xl font-black italic" style={{ color: "#facc15" }}>How to play</p>
                {[
                  { icon: Crosshair, title: "Aim", text: "Move the mouse over the goal, or drag with your finger. Arrow keys work too." },
                  { icon: Gauge, title: "Power", text: "The bar goes up and down. Harder is faster but less accurate: a hard shot can go wide." },
                  { icon: Goal, title: "Shoot", text: "Press SHOOT, click the goal, or press Space. The keeper dives: pick your corner!" },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex items-start gap-3 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Icon size={22} style={{ color: "#facc15" }} className="mt-0.5 shrink-0" aria-hidden />
                    <p className="text-sm" style={{ color: "#e2e8f0" }}><b style={{ color: "#ffffff" }}>{title}.</b> {text}</p>
                  </div>
                ))}
                <button type="button" onClick={() => { markTutorialSeen(); setTutorialDone(true); }} className="mx-auto mt-1 rounded-full px-8 py-3 text-sm font-extrabold" style={{ background: "#facc15", color: "#0c0b5d" }}>Got it</button>
              </div>
            )}

            {/* full time */}
            {mode !== "idle" && finished && (
              <div className="uf-keep absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center" style={{ background: "rgba(3,10,31,0.86)", color: "#ffffff" }}>
                <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Full time</p>
                <p className="text-4xl font-black italic" style={{ color: "#ffffff" }}>{goals} / {RULES.shotsPerGame}</p>
                <p className="text-sm" style={{ color: "#cbd5e1" }}>{goals} goal{goals === 1 ? "" : "s"} · {shots.filter((s) => s.outcome === "save").length} saved · {shots.filter((s) => s.outcome !== "goal" && s.outcome !== "save").length} missed</p>
                {mode === "reward" && game && (
                  game.points > 0
                    ? <p className="rounded-full px-5 py-2 text-lg font-black" style={{ background: "#22c55e", color: "#ffffff" }}>+{game.points} Loyalty Point{game.points === 1 ? "" : "s"}</p>
                    : <p className="text-sm font-semibold" style={{ color: "#fde68a" }}>No points this time. Score {RULES.goalsToQualify} or more goals to earn {pts(RULES.pointsPerGame)}.</p>
                )}
                {mode === "practice" && <p className="text-sm font-semibold" style={{ color: "#fde68a" }}>Practice game: no points.{!registered ? " Register to play for points." : ""}</p>}
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {registered && left > 0 && (
                    <button type="button" disabled={busy} onClick={playForPoints} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold disabled:opacity-60" style={{ background: "#facc15", color: "#0c0b5d" }}>
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Play again ({left} left today)
                    </button>
                  )}
                  <button type="button" onClick={playPractice} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff" }}><RotateCcw size={16} /> Practice</button>
                  {!registered && <button type="button" onClick={openSignIn} className="rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: "#22c55e", color: "#ffffff" }}>Register to earn</button>}
                </div>
              </div>
            )}
          </div>

          {mode !== "idle" && !finished && !showTutorial && (
            <button type="button" onClick={() => gameRef.current?.shoot()} className="uf-keep flex w-full items-center justify-center gap-2 rounded-full py-4 text-lg font-black italic tracking-wide" style={{ background: "#facc15", color: "#0c0b5d", boxShadow: "0 10px 24px -8px rgba(250,204,21,0.8)" }}>
              <Goal size={22} /> SHOOT
            </button>
          )}
          {message && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{message}</p>}
          <p className="sr-only" role="status" aria-live="polite">{announce}</p>

          {shots.length > 0 && (
            <ol className="glass space-y-1.5 rounded-3xl p-4 text-sm" aria-label="This game, shot by shot">
              {shots.map((s) => (
                <li key={s.no} className="flex items-center justify-between">
                  <span className="text-slate-500">Shot {s.no}</span>
                  <span className={`font-semibold ${s.outcome === "goal" ? "text-emerald-600" : s.outcome === "save" ? "text-amber-600" : "text-slate-600"}`}>{OUTCOME_TEXT[s.outcome]}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          {/* today */}
          <section className="glass rounded-3xl p-5" aria-label="Today">
            <h2 className="text-base font-semibold">Today</h2>
            {registered ? (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-sky-50 p-3"><dt className="text-xs text-slate-500">Games Played Today</dt><dd className="text-xl font-bold text-[#0c0b5d]">{allowance ? `${allowance.used}/${allowance.limit}` : "…"}</dd></div>
                <div className="rounded-2xl bg-sky-50 p-3"><dt className="text-xs text-slate-500">Points today</dt><dd className="text-xl font-bold text-[#0c0b5d]">{allowance ? `${allowance.pointsToday}/${allowance.maxPointsPerDay}` : "…"}</dd></div>
                <div className="col-span-2 flex items-center justify-between rounded-2xl bg-emerald-50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-600"><Star size={14} className="text-emerald-600" /> Your loyalty points</dt>
                  <dd className="text-xl font-bold text-emerald-700">{loyalty ? loyalty.remaining : me ? me.balance : "…"}</dd>
                </div>
              </dl>
            ) : (
              <div className="mt-2 space-y-3 text-sm text-slate-600">
                <p>Guests can play practice games. Points are for registered players.</p>
                <button type="button" onClick={openSignIn} className="glass-btn w-full rounded-full py-3 text-sm font-semibold">Register / Sign in</button>
              </div>
            )}
          </section>

          {/* the rules */}
          <section className="glass rounded-3xl p-5" aria-label="How you earn">
            <h2 className="text-base font-semibold">How you earn</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>• Every game is {RULES.shotsPerGame} penalties against our goalkeeper.</li>
              <li>• Score <b>at least {RULES.goalsToQualify} goals</b> out of {RULES.shotsPerGame} to earn: every {RULES.goalsPerPoint} goals = <b>1 loyalty point</b>, so a game earns {pts(RULES.pointsPerGame)}.</li>
              <li>• Fewer than {RULES.goalsToQualify} goals, no points, but the game still counts.</li>
              <li>• {RULES.gamesPerDay} games a day, so up to <b>{pts(RULES.maxPointsPerDay)} a day</b>. A game you start counts, even if you leave it.</li>
              <li>• Points go straight into your Unique Futsal loyalty balance and last 3 months.</li>
            </ul>
          </section>

          {/* last games */}
          {registered && me && me.recent.length > 0 && (
            <section className="glass rounded-3xl p-5" aria-label="Your recent games">
              <h2 className="text-base font-semibold">Your recent games</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {me.recent.slice(0, 6).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">{new Date(g.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {new Date(g.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="font-semibold">{g.status === "completed" ? `${g.goals}/${RULES.shotsPerGame}` : "Not finished"}</span>
                    <span className={`w-14 text-right font-bold ${g.points > 0 ? "text-emerald-600" : "text-slate-400"}`}>{g.points > 0 ? `+${g.points}` : "0"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/book" className="glass flex items-center gap-3 rounded-3xl p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-[#0c0b5d]"><CalendarDays size={20} /></span>
            <span className="text-sm"><b className="block">Play for real</b><span className="text-slate-500">Book a court at Unique Futsal</span></span>
          </Link>
        </aside>
      </div>
    </main>
  );
}
