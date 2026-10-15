// Unique Goal Rush (penalty game): the customer app's side. The server plays the goalkeeper, decides every shot, counts
// the games of the day and writes the loyalty points (see backend docs/API.md, "Unique Goal Rush"). The app only sends
// where the player aimed and how hard, and plays back the result it is given.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import type { Outcome, ShotInput, Zone } from "@/lib/goalrush-sim";

export interface GRRules {
  shotsPerGame: number;
  gamesPerDay: number;
  goalsToQualify: number; // a game needs this many goals to earn anything
  goalsPerPoint: number; // then every this many goals = 1 point
  pointsPerGame: number;
  maxPointsPerDay: number;
}

export interface GRShot {
  no: number;
  outcome: Outcome;
  ballX: number;
  ballY: number;
  keeper: Zone;
  aimX: number;
  aimY: number;
  power: number;
}

export interface GRGame {
  id: string;
  day: string;
  status: "active" | "completed" | "abandoned";
  shotsTaken: number;
  shotsLeft: number;
  goals: number;
  saves: number;
  misses: number;
  points: number;
  rewardId: string | null;
  startedAt: string;
  finishedAt: string | null;
  shots: GRShot[];
}

export interface GRAllowance {
  day: string;
  limit: number;
  used: number;
  left: number;
  pointsToday: number;
  maxPointsPerDay: number;
  resetsAt: string;
}

export interface GRMe {
  rules: GRRules;
  allowance: GRAllowance;
  active: GRGame | null;
  balance: number;
  recent: GRGame[];
}

export const RULES: GRRules = { shotsPerGame: 5, gamesPerDay: 3, goalsToQualify: 3, goalsPerPoint: 3, pointsPerGame: 1, maxPointsPerDay: 3 };
export const pts = (n: number) => `${n} loyalty point${n === 1 ? "" : "s"}`;

export const goalRushStore = createRemoteStore<GRMe | null>(() => api<GRMe>("/goal-rush/me"), { signedOut: null });

export const startGame = () => api<{ game: GRGame; resumed: boolean; allowance: GRAllowance }>("/goal-rush/games", { method: "POST" });

export const sendShot = (gameId: string, no: number, s: ShotInput) =>
  api<{ shot: GRShot; game: GRGame; allowance: GRAllowance }>(`/goal-rush/games/${encodeURIComponent(gameId)}/shots`, {
    method: "POST",
    body: { no, aimX: s.aimX, aimY: s.aimY, power: s.power },
  });

export const OUTCOME_TEXT: Record<Outcome, string> = {
  goal: "Goal",
  save: "Saved",
  wide: "Wide",
  over: "Over the bar",
  post: "Off the post",
};

const MUTE_KEY = "uf-goalrush-muted";
const TUTORIAL_KEY = "uf-goalrush-tutorial";
export function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function saveMuted(v: boolean) {
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* private mode: fine */ }
}
export function tutorialSeen(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === "1"; } catch { return true; }
}
export function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* fine */ }
}
