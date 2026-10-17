// Find Player: "I need N more players" for a game. Every registered customer gets a notification; they tap "I'm in"
// until the spots are full. The server owns the counts, the limits and who may join (see backend docs/API.md).

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import { AGE_GROUPS } from "@/lib/age";

export interface PlayerRequest {
  id: string;
  posterName: string;
  mine: boolean;
  date: string;
  hour: number;
  playersNeeded: number;
  ageGroups: string[]; // ["open"] (anyone), or one or more groups such as ["20-25", "30-35"]
  eligible: boolean; // false: the game is for another age group, or the viewer has no date of birth yet
  needsDob: boolean; // an age-group game and the viewer has not given a date of birth
  joined: number;
  spotsLeft: number;
  note: string | null;
  status: "open" | "awaiting_advance" | "confirmed" | "cancelled" | "expired";
  joinedByMe: boolean;
  joiners?: { phone: string; name: string }[]; // only the poster gets this
  // a friendly game: the court price is shared equally by everyone playing, whoever wins or loses
  courtPrice: number;
  everyone: number; // the host plus the invited players
  sharePerPlayer: number;
  hostShare: number;
  advanceFee: number; // paid online by the host once everyone has joined; it books the court
  hostPaysAtVenue: number; // the host's share minus the advance
  advanceDueAt: string | null;
  confirmed: boolean;
  createdAt: string;
}

export interface AdvanceOrder {
  orderCode: string;
  method: "fonepay";
  amount: number;
  remarks: string;
  qrPayload: string;
  expiresAt: string;
  status: string;
}

export interface PlayerRules {
  maxPlayers: number;
  windowDays: number;
  advanceFee: number;
  perDay: number;
  noteMax: number;
  hours: number[];
  ageGroups: string[];
}

// Shown while the rules load, or if the server cannot be reached.
export const FALLBACK_RULES: PlayerRules = {
  maxPlayers: 11,
  windowDays: 6,
  advanceFee: 300,
  perDay: 3,
  noteMax: 140,
  hours: Array.from({ length: 17 }, (_, i) => 6 + i),
  ageGroups: [...AGE_GROUPS],
};

export const requestsStore = createRemoteStore<PlayerRequest[]>(() => api<PlayerRequest[]>("/player-requests"), { pollMs: 15000, signedOut: [] });

export const loadRules = () => api<PlayerRules>("/player-requests/rules");
export const loadRequest = (id: string) => api<PlayerRequest>(`/player-requests/${encodeURIComponent(id)}`);
export const postRequest = (r: { date: string; hour: number; players: number; note?: string; ageGroups?: string[] }) =>
  api<{ id: string }>("/player-requests", { method: "POST", body: r });
export const joinRequest = (id: string) => api<PlayerRequest>(`/player-requests/${encodeURIComponent(id)}/join`, { method: "POST" });
export const leaveRequest = (id: string) => api<PlayerRequest>(`/player-requests/${encodeURIComponent(id)}/leave`, { method: "POST" });
export const payAdvance = (id: string) => api<AdvanceOrder>(`/player-requests/${encodeURIComponent(id)}/advance`, { method: "POST" });
export const cancelRequest = (id: string) => api<PlayerRequest>(`/player-requests/${encodeURIComponent(id)}/cancel`, { method: "POST" });

export const playersLabel = (n: number) => `${n} Player${n === 1 ? "" : "s"}`;
