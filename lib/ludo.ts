// Unique Ludo: the customer app's side. The SERVER runs the game (dice, legal moves, captures, winner, points and the
// daily limits; see backend docs/API.md "Unique Ludo"). The app sends actions ("roll", "move token 2") with the game's
// action counter, and draws what the server returns. Nothing here decides a result.

import { useEffect, useRef, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { getTokens } from "@/lib/auth-token";
import { createRemoteStore } from "@/lib/remote-store";

export type ColorName = "red" | "green" | "yellow" | "blue";
export const COLOR_ORDER: ColorName[] = ["red", "green", "yellow", "blue"];

export interface LudoRules {
  entryFee: number;
  winReward: number;
  soloLimit: number;
  multiLimit: number;
  minPlayers: number;
  maxPlayers: number;
  turnSeconds: number;
  graceSeconds: number;
  strikes: number;
  maxSixes: number;
}
// shown before sign-in; the server's numbers (GET /ludo/rules and /ludo/me) replace them
export const DEFAULT_RULES: LudoRules = { entryFee: 1, winReward: 2, soloLimit: 4, multiLimit: 5, minPlayers: 2, maxPlayers: 4, turnSeconds: 45, graceSeconds: 60, strikes: 3, maxSixes: 3 };

export interface LudoPlayer {
  id: string;
  seat: number;
  color: ColorName;
  name: string;
  avatar: string | null;
  isBot: boolean;
  botControl: boolean;
  isMe: boolean;
  isHost: boolean;
  online: boolean;
  ready: boolean;
  status: string;
  result: string | null;
  rank: number | null;
  captures: number;
  lost: number;
  home: number;
}

export interface LudoBoard {
  colors: number[];
  tokens: number[][];
  turn: number;
  phase: "roll" | "move" | "over";
  dice: number | null;
  sixes: number;
  legal: number[];
  winner: number | null;
  captures: number[];
  lost: number[];
  seq: number;
}

export type LudoEventItem =
  | { type: "roll"; seat: number; value: number }
  | { type: "move"; seat: number; token: number; from: number; to: number; value: number }
  | { type: "release"; seat: number; token: number }
  | { type: "capture"; seat: number; token: number; victimSeat: number; victimToken: number; square: number }
  | { type: "home"; seat: number; token: number }
  | { type: "nomove"; seat: number; value: number }
  | { type: "forfeit"; seat: number }
  | { type: "extra"; seat: number; reason: "six" | "capture" | "home" }
  | { type: "turn"; seat: number }
  | { type: "win"; seat: number }
  | { type: "auto" | "takeover" | "back" | "start"; seat?: number; text?: string };

export interface LudoInvite {
  id: string;
  name: string;
  avatar: string | null;
  status: "invited" | "declined";
  online: boolean;
  isMe: boolean;
}

export interface LudoGame {
  id: string;
  code: string;
  mode: "solo" | "multi";
  status: "lobby" | "active" | "completed" | "cancelled" | "abandoned";
  difficulty: "easy" | "normal" | "hard";
  maxPlayers: number;
  hostName: string;
  isHost: boolean;
  mySeat: number | null;
  myPlayerId: string | null;
  players: LudoPlayer[];
  invites: LudoInvite[];
  myInviteId: string | null;
  board: LudoBoard | null;
  last: LudoEventItem[];
  turnEndsAt: string | null;
  you: { fee: number; reward: number };
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelReason: string | null;
  serverNow: string;
  outcome: { winnerSeat: number | null; ranking: number[]; youWon: boolean; pointsEarned: number; pointsSpent: number; refunded: boolean } | null;
}

export interface Usage { used: number; limit: number; left: number }
export interface HistoryRow {
  id: string;
  code: string;
  mode: "solo" | "multi";
  status: string;
  at: string;
  durationSec: number;
  opponents: string[];
  result: string;
  pointsSpent: number;
  pointsEarned: number;
  refunded: boolean;
  players: number;
}
export interface Stats { played: number; wins: number; losses: number; winRate: number; captures: number; vsFriends: number; bestStreak: number }
export interface LudoMe {
  rules: LudoRules;
  balance: number;
  limits: { day: string; solo: Usage; multi: Usage; resetsAt: string };
  current: { id: string; code: string; status: string; mode: string } | null;
  invites: { id: string; gameId: string; code: string; from: string; at: string }[];
  friends: { total: number; online: number };
  recent: HistoryRow[];
  stats: Stats;
}
export interface LudoFriend { phone: string; name: string; avatar: string | null; online: boolean; invite: "none" | "invited" | "declined" | "cancelled" | "accepted" | "joined" }
export interface LeaderRow { rank: number; name: string; wins: number; played: number; winRate: number }

export const ludoStore = createRemoteStore<LudoMe | null>(() => api<LudoMe>("/ludo/me"), { signedOut: null, pollMs: 20000 });

const j = (id: string) => encodeURIComponent(id);
export const startSolo = (opponents: number, difficulty: string) => api<LudoGame>("/ludo/solo", { method: "POST", body: { opponents, difficulty } });
export const createRoom = (maxPlayers: number) => api<LudoGame>("/ludo/rooms", { method: "POST", body: { maxPlayers } });
export const getRoom = (idOrCode: string) => api<LudoGame>(`/ludo/rooms/${j(idOrCode)}`);
export const inviteFriend = (id: string, phone: string) => api(`/ludo/rooms/${j(id)}/invite`, { method: "POST", body: { phone } });
export const cancelInvite = (id: string, inviteId: string) => api(`/ludo/rooms/${j(id)}/invites/${j(inviteId)}`, { method: "DELETE" });
export const setReady = (id: string, ready: boolean) => api(`/ludo/rooms/${j(id)}/ready`, { method: "POST", body: { ready } });
export const kickPlayer = (id: string, playerId: string) => api(`/ludo/rooms/${j(id)}/players/${j(playerId)}`, { method: "DELETE" });
export const cancelRoom = (id: string) => api(`/ludo/rooms/${j(id)}/cancel`, { method: "POST" });
export const startRoom = (id: string) => api(`/ludo/rooms/${j(id)}/start`, { method: "POST" });
export const leaveGame = (id: string) => api(`/ludo/games/${j(id)}/leave`, { method: "POST" });
export const acceptInvite = (inviteId: string) => api<{ gameId: string; code: string }>(`/ludo/invites/${j(inviteId)}/accept`, { method: "POST" });
export const declineInvite = (inviteId: string) => api(`/ludo/invites/${j(inviteId)}/decline`, { method: "POST" });
export const joinByCode = (code: string) => api<{ gameId: string; code: string }>("/ludo/rooms/join", { method: "POST", body: { code } });
export const rollDice = (id: string, seq: number) => api<LudoGame>(`/ludo/games/${j(id)}/roll`, { method: "POST", body: { seq } });
export const moveToken = (id: string, token: number, seq: number) => api<LudoGame>(`/ludo/games/${j(id)}/move`, { method: "POST", body: { token, seq } });
export const fetchFriends = (room?: string, q?: string) => api<LudoFriend[]>("/ludo/friends", { query: { room, q } });
export const fetchHistory = (limit = 20, skip = 0) => api<HistoryRow[]>("/ludo/history", { query: { limit, skip } });
export const fetchLeaderboard = (period: string, sort: string, mode: string) => api<{ rows: LeaderRow[]; minGamesForRate: number }>("/ludo/leaderboard", { query: { period, sort, mode } });

/** "2m 05s" */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;
export const points = (n: number) => `${n} Loyalty Point${n === 1 ? "" : "s"}`;

/** When a game could be played again after a daily limit: the next midnight in Nepal (the server sends the exact time). */
export function resetText(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }) + " Nepal time";
  } catch {
    return "tomorrow";
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Real-time line to the server: a WebSocket at /api/ludo/ws that only says "this game changed" (and carries the new
// view). Everything the player DOES goes through the signed-in routes above. If the line drops, it reconnects by
// itself and the page keeps asking the server at a slower pace, so the game always catches up.

function socketUrl() {
  return API_URL.replace(/^http/i, "ws") + "/ludo/ws";
}

export function useLudoSocket(onGame: (g: LudoGame) => void, onOpen?: () => void): boolean {
  const [connected, setConnected] = useState(false);
  const cb = useRef(onGame);
  const open = useRef(onOpen);
  useEffect(() => {
    cb.current = onGame;
    open.current = onOpen;
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    function connect() {
      if (stopped) return;
      const t = getTokens();
      if (!t) return; // guests have no game
      try {
        ws = new WebSocket(socketUrl());
      } catch {
        schedule();
        return;
      }
      const sock = ws;
      sock.onopen = () => sock.send(JSON.stringify({ type: "auth", token: getTokens()?.token ?? t.token }));
      sock.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data)) as { type: string; game?: LudoGame };
          if (m.type === "ready") {
            tries = 0;
            setConnected(true);
            open.current?.();
            clearInterval(ping);
            ping = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send('{"type":"ping"}'), 25000);
          } else if (m.type === "game" && m.game) cb.current(m.game);
        } catch { /* ignore a broken message */ }
      };
      sock.onclose = (e) => {
        clearInterval(ping);
        setConnected(false);
        if (stopped) return;
        // an expired token: asking for something refreshes it, then we try again
        if (e.code === 4401) void api("/ludo/rules", { auth: "none" }).then(() => api("/ludo/me")).catch(() => undefined).finally(schedule);
        else schedule();
      };
      sock.onerror = () => sock.close();
    }
    function schedule() {
      if (stopped) return;
      tries++;
      timer = setTimeout(connect, Math.min(10000, 800 * 2 ** Math.min(tries, 4)));
    }
    connect();
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!ws || ws.readyState === WebSocket.CLOSED)) { clearTimeout(timer); connect(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      ws?.close();
    };
  }, []);

  return connected;
}

// ---------------------------------------------------------------------------------------------------------------
// preferences (this browser only)
const MUTE = "uf-ludo-muted";
const MUSIC = "uf-ludo-music";
const VIBRATE = "uf-ludo-vibrate";
const SEEN = "uf-ludo-rules-seen";
const read = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch { return d; } };
const write = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch { /* private mode */ } };
export const readSfxOn = () => !read(MUTE, false);
export const saveSfxOn = (on: boolean) => write(MUTE, !on);
export const readVibrateOn = () => read(VIBRATE, true);
export const saveVibrateOn = (on: boolean) => write(VIBRATE, on);
export const readMusicOn = () => read(MUSIC, false);
export const saveMusicOn = (on: boolean) => write(MUSIC, on);
export const rulesSeen = () => read(SEEN, false);
export const markRulesSeen = () => write(SEEN, true);
