// Unique Club: Rs. 1,500 for 30 days, 10% off court bookings, Gamezone and hosted tournaments; promo and VIP codes are not
// used with it. The server decides the discount and who is a member; the app only shows it (see backend docs/API.md).

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface ClubStatus {
  fee: number;
  days: number;
  percent: number;
  member: boolean; // active right now
  expired: boolean; // was a member, the days have run out
  validUntil: string | null;
  daysLeft: number;
  since: string | null;
  payments: number;
  // the membership-plan and tournament-hosting discounts unlock after 15 days in the club or 5 games played since joining
  matureAfterDays: number;
  matureAfterGames: number;
  mature: boolean;
  daysIn: number;
  gamesPlayed: number;
  daysToMature: number;
  gamesToMature: number;
}

export interface ClubOrder {
  orderCode: string;
  method: "fonepay";
  amount: number;
  remarks: string;
  qrPayload: string;
  expiresAt: string;
  status: string;
}

// Before the server answers (or if it cannot be reached) the page still shows the price and the percentage.
export const FALLBACK: ClubStatus = { fee: 1500, days: 30, percent: 10, member: false, expired: false, validUntil: null, daysLeft: 0, since: null, payments: 0, matureAfterDays: 15, matureAfterGames: 5, mature: false, daysIn: 0, gamesPlayed: 0, daysToMature: 15, gamesToMature: 5 };

export const clubStore = createRemoteStore<ClubStatus | null>(() => api<ClubStatus>("/club"), { signedOut: null });

export const joinClub = () => api<ClubOrder>("/club/join", { method: "POST" });

/** The discount for an amount, the way the server rounds it (whole rupees). */
export const clubOff = (amount: number, percent: number) => Math.round((amount * percent) / 100);
