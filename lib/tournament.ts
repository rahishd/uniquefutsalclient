// The tournament shown on Home and the Tournaments page, from the server (GET /tournaments/current).
// The server returns nothing when no tournament is being hosted (the Home section then hides).
// Team contact details are never part of this public view.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export type MatchStatus = "finished" | "live" | "upcoming";

export interface TieMatch {
  id: string;
  status: MatchStatus;
  home: string | null; // null = to be decided
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
  note: string | null; // e.g. penalties
  startsAt: string | null;
  venue: string | null;
  goals?: TieGoal[]; // in minute order, entered by the venue
}

export interface TieGoal {
  side: "home" | "away";
  minute: number | null;
  scorer: string | null;
}

export interface TieRound {
  id: string;
  name: string;
  matches: TieMatch[];
}

export interface Tournament {
  id: string;
  name: string;
  status: "live" | "upcoming" | "completed";
  startDate: string;
  endDate: string;
  teams: number;
  prizePool: number;
  entryFee?: number; // rupees per team, 0 = free entry
  prizes?: { first?: string; second?: string; third?: string };
  format?: string;
  // an event the venue hosts for a manager: no team sign-up, just the host and the hours of each day
  hosted?: { hostName: string | null; days: { date: string; startHour: number; endHour: number }[] };
  rounds: TieRound[];
}

const h12 = (h: number) => `${h % 24 % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;
export const hoursLabel = (d: { startHour: number; endHour: number }) => `${h12(d.startHour)} to ${h12(d.endHour)}`;

export interface HostedEvent { id: string; name: string; hostName: string | null; entryFee?: number; startDate: string; endDate: string; days: { date: string; startHour: number; endHour: number }[] }
export const eventsStore = createRemoteStore<HostedEvent[]>(() => api<HostedEvent[]>("/tournaments/events", { auth: "none" }), { pollMs: 60000 });

export const tournamentStore = createRemoteStore<Tournament | null>(() => api<Tournament | null>("/tournaments/current", { auth: "none" }), { pollMs: 30000 });

export const matchTime = (m: TieMatch) => (m.startsAt ? new Date(m.startsAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

// Matches the signed-in customer follows for live updates (kick-off, goals, full time). Guests follow nothing.
export const followStore = createRemoteStore<string[]>(() => api<string[]>("/tournaments/following"), { signedOut: [], pollMs: 60_000 });

export async function setFollowing(matchId: string, on: boolean): Promise<void> {
  await api(`/tournaments/matches/${matchId}/follow`, { method: on ? "PUT" : "DELETE" });
  followStore.patch((ids) => (on ? [...new Set([...ids, matchId])] : ids.filter((x) => x !== matchId)));
}

// ---- team registration for one tournament (the shareable link: /tournaments/<id>/register) ----
export interface RegistrationInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prizePool: number;
  entryFee: number; // rupees per team, 0 = free entry
  format?: string;
  hosted: { hostName: string | null } | null;
  registered: number;
  limit: number | null; // null = no limit on teams
  spotsLeft: number | null;
  open: boolean;
  closedReason: string | null;
}

export const fetchRegistrationInfo = (id: string) => api<RegistrationInfo>(`/tournaments/${encodeURIComponent(id)}/registration`, { auth: "none" });

export const submitTeam = (id: string, team: { teamName: string; captainName: string; contactPhone: string; contactEmail: string }) =>
  api<{ id: string; teamName: string; status: string; tournamentName: string }>(`/tournaments/${encodeURIComponent(id)}/register`, { method: "POST", body: team, auth: "none" });

export const registrationPath = (id: string) => `/tournaments/${encodeURIComponent(id)}/register`;
// The full address to share. Built in the browser, so it is always the address the customer is on.
export const registrationLink = (id: string) => `${typeof window !== "undefined" ? window.location.origin : ""}${registrationPath(id)}`;

// Is a tournament still worth offering registration for (not finished)?
// Sign-up is open only before the tournament starts; once it is live (or finished) the team list is fixed.
export const canRegister = (t: { status?: string }) => t.status === "upcoming";

// ---- upcoming tournaments (the "View Upcoming Tournaments" page) ----
// The public list: every tournament the venue runs. The page keeps the ones that have not started.
export const tournamentListStore = createRemoteStore<Tournament[]>(() => api<Tournament[]>("/tournaments", { auth: "none" }), { pollMs: 60000 });

// ---- tie-sheet PDF ----
const sideName = (n: string | null) => n ?? "To be decided";
const MATCH_STATE: Record<MatchStatus, string> = { finished: "Full time", live: "Live", upcoming: "Upcoming" };

/** The whole tie-sheet as a table for downloadPdf: one row per match with its score, status, time and scorers. */
export function tieSheetPdf(t: Tournament) {
  const rows = t.rounds.flatMap((r) =>
    r.matches.map((m) => [
      r.name,
      `${sideName(m.home)} vs ${sideName(m.away)}`,
      m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : "-",
      m.note && m.status !== "live" ? `${MATCH_STATE[m.status]} (${m.note})` : MATCH_STATE[m.status],
      matchTime(m) || "-",
      (m.goals ?? []).map((g) => `${g.scorer || "Goal"}${g.minute !== null ? ` ${g.minute}'` : ""} (${g.side === "home" ? sideName(m.home) : sideName(m.away)})`).join(", ") || "-",
    ]),
  );
  return {
    filename: `${t.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tournament"}-tie-sheet.pdf`,
    title: `${t.name}: Tie-sheet`,
    lines: [`${t.startDate} to ${t.endDate}`, t.format ?? `${t.teams} teams`],
    columns: [
      { header: "Round", width: 62 },
      { header: "Match", width: 125 },
      { header: "Score", width: 40 },
      { header: "Status", width: 62 },
      { header: "When", width: 76 },
      { header: "Goals", width: 150 },
    ],
    rows,
  };
}
