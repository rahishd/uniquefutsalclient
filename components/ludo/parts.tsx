"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Music, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { COLORS } from "@/lib/ludo-board";
import { DEFAULT_RULES, readMusicOn, readSfxOn, saveMusicOn, saveSfxOn, type ColorName, type LudoRules } from "@/lib/ludo";
import { ludoSound } from "@/lib/ludo-sound";

/** The full-screen window every Ludo page lives in: title, Back, and the sound and music switches. */
const noop = () => () => undefined;

export function LudoFrame({ title = "Unique Ludo", subtitle, back, right, children }: { title?: string; subtitle?: string; back?: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const storedSfx = useSyncExternalStore(noop, readSfxOn, () => true);
  const storedMusic = useSyncExternalStore(noop, readMusicOn, () => false);
  const [sfxChoice, setSfx] = useState<boolean | null>(null);
  const [musicChoice, setMusic] = useState<boolean | null>(null);
  const sfx = sfxChoice ?? storedSfx;
  const music = musicChoice ?? storedMusic;

  useEffect(() => {
    const m = readMusicOn();
    ludoSound.setSfx(readSfxOn());
    // the music is the player's own choice; browsers only allow sound after a tap, so it starts on the first one
    const start = () => { if (m) ludoSound.startMusic(); };
    window.addEventListener("pointerdown", start, { once: true });
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("pointerdown", start); ludoSound.stopMusic(); html.style.overflow = prev; };
  }, []);

  function toggleSfx() {
    const next = !sfx;
    setSfx(next); saveSfxOn(next); ludoSound.setSfx(next);
    if (next) ludoSound.button();
  }
  function toggleMusic() {
    const next = !music;
    setMusic(next); saveMusicOn(next);
    if (next) ludoSound.startMusic(); else ludoSound.stopMusic();
  }
  const goBack = back ?? (() => (window.history.length > 1 ? router.back() : router.push("/")));

  return (
    <div className="lu-root">
      <header className="lu-top">
        <button type="button" className="lu-icon" onClick={goBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="lu-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {right}
        <button type="button" className="lu-icon" onClick={toggleMusic} aria-pressed={music} aria-label={music ? "Turn music off" : "Turn music on"}><Music size={18} /></button>
        <button type="button" className="lu-icon" onClick={toggleSfx} aria-pressed={!sfx} aria-label={sfx ? "Mute sound effects" : "Turn sound effects on"}>{sfx ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </header>
      {children}
    </div>
  );
}

export function Avatar({ name, src, color, size = 40 }: { name: string; src?: string | null; color?: ColorName; size?: number }) {
  const ring = color ? COLORS[color].main : "#ffffff55";
  const initials = name.replace(/\(.*\)/, "").trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="lu-avatar" style={{ width: size, height: size, ["--ring" as string]: ring, fontSize: size * 0.4 }} aria-hidden>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** A die. `value` null shows a blank face; the tumble plays while `rolling`. */
export function Die({ value, rolling, ready, onClick, label }: { value: number | null; rolling?: boolean; ready?: boolean; onClick?: () => void; label?: string }) {
  const [flick, setFlick] = useState<number | null>(null);
  useEffect(() => {
    if (!rolling) return;
    const t = setInterval(() => setFlick(1 + Math.floor(Math.random() * 6)), 70);
    return () => clearInterval(t);
  }, [rolling]);
  const shown = rolling ? flick ?? value : value;
  const on = new Set(shown ? PIPS[shown] : []);
  return (
    <button type="button" onClick={ready ? onClick : undefined} disabled={!ready} aria-label={label ?? (value ? `Dice shows ${value}` : "Roll the dice")}
      className={`lu-die${ready ? " ready" : ""}${rolling ? " rolling" : ""}${shown === 6 ? " six" : ""}`}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={on.has(i) ? "on" : ""} />)}
      {!shown && <span className="lu-die-hint">{ready ? "ROLL" : ""}</span>}
    </button>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="lu-sheet-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="lu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" className="lu-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RulesSheet({ onClose, rules = DEFAULT_RULES, onContinue }: { onClose: () => void; rules?: LudoRules; onContinue?: () => void }) {
  const li = "flex gap-2 text-sm leading-snug";
  const b = <span className="lu-gold mt-0.5">&#9679;</span>;
  return (
    <Sheet title="How to play Unique Ludo" onClose={onClose}>
      <h3 className="lu-h2">Points</h3>
      <ul className="mb-4 space-y-2">
        <li className={li}>{b}<span>Every player pays <b>{rules.entryFee} Loyalty Point</b> when the game starts. Opening or browsing a lobby is free.</span></li>
        <li className={li}>{b}<span>The winner gets <b>+{rules.winReward} Loyalty Points</b>. Against the computer, you win by beating every computer player. Losers get nothing and computers never earn points.</span></li>
        <li className={li}>{b}<span>Daily limit (Nepal time): <b>{rules.soloLimit} single player</b> and <b>{rules.multiLimit} multiplayer</b> games. A game counts when it starts, and leaving it does not give it back.</span></li>
      </ul>
      <h3 className="lu-h2">The game</h3>
      <ul className="mb-4 space-y-2">
        <li className={li}>{b}<span>Roll the dice when it is your turn. You need a <b>6</b> to bring a token out of your yard.</span></li>
        <li className={li}>{b}<span>Move one token the number shown. Tap a glowing token to choose. A token needs the exact number to reach home.</span></li>
        <li className={li}>{b}<span>Landing on an opponent captures it and sends it back to its yard. Tokens on <b>safe squares</b> (the star squares and every colour&apos;s start square) cannot be captured.</span></li>
        <li className={li}>{b}<span>You roll again after a <b>6</b>, a <b>capture</b>, or getting a token <b>home</b>. Three sixes in a row lose your turn.</span></li>
        <li className={li}>{b}<span>The first player with all four tokens home wins and the game ends at once.</span></li>
      </ul>
      <h3 className="lu-h2">Playing with friends</h3>
      <ul className="space-y-2">
        <li className={li}>{b}<span>Create a private room and invite friends from your Unique Futsal friend list. 2 to 4 players. Only invited friends can join.</span></li>
        <li className={li}>{b}<span>You have {rules.turnSeconds} seconds per turn. If you run out of time the game plays for you; after {rules.strikes} missed turns in a row, or if you stay disconnected for {rules.graceSeconds} seconds, the computer plays your seat until you come back.</span></li>
        <li className={li}>{b}<span>If you leave a game that has started, you do not get the point back and you cannot win it.</span></li>
      </ul>
      {onContinue && <button type="button" className="lu-btn mt-5 block w-full" onClick={onContinue}>I understand, let&apos;s play</button>}
    </Sheet>
  );
}
