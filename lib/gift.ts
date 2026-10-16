// Gift Card (Quick Access > Gift Card): give a registered friend loyalty points (Rs. 10 a point) or a game booked in their
// name. The buyer pays with the Fonepay QR; the server checks the friend, sets the price and only delivers once it is paid.

import { api } from "@/lib/api";

export interface GiftRules {
  rsPerPoint: number;
  minPoints: number;
  maxPoints: number;
  perDay: number;
}

export interface GiftFriend {
  phone: string;
  firstName: string;
}

export interface GiftView {
  id: string;
  code: string;
  kind: "points" | "game";
  role: "sent" | "received";
  otherName: string;
  points: number | null;
  amount: number;
  message: string | null;
  status: "pending" | "paid" | "expired" | "refunded"; // refunded: the venue cancelled it and pays the buyer back
  game: { date: string; startTime: string; endTime: string; code: string | null } | null;
  createdAt: string;
  paidAt: string | null;
}

export interface GiftOrder {
  orderCode: string;
  method: "fonepay";
  amount: number;
  remarks: string;
  qrPayload: string;
  expiresAt: string;
  status: string;
}

export interface GameQuote {
  friend: GiftFriend;
  date: string;
  startTime: string;
  basePrice: number;
  discount: number;
  total: number;
}

export const FALLBACK_RULES: GiftRules = { rsPerPoint: 10, minPoints: 10, maxPoints: 500, perDay: 5 };

export const loadGiftRules = () => api<GiftRules>("/gifts/rules", { auth: "none" });
export const loadGifts = () => api<{ rules: GiftRules; gifts: GiftView[] }>("/gifts");
export const findFriend = (phone: string) => api<GiftFriend>(`/gifts/friend/${encodeURIComponent(phone)}`);
export const giftPoints = (body: { friendPhone: string; points: number; message?: string }) =>
  api<{ gift: GiftView; payment: GiftOrder }>("/gifts/points", { method: "POST", body });
export const quoteGiftGame = (body: { friendPhone: string; date: string; startTime: string }) => api<GameQuote>("/gifts/game/quote", { method: "POST", body });
export const giftGame = (body: { friendPhone: string; date: string; startTime: string; message?: string }) =>
  api<{ gift: GiftView; payment: GiftOrder }>("/gifts/game", { method: "POST", body });

export const POINT_PACKS = [25, 50, 125, 250];

export const STATUS_TEXT: Record<GiftView["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting for payment", tone: "bg-amber-400/25 text-amber-700" },
  paid: { label: "Delivered", tone: "bg-emerald-400/25 text-emerald-700" },
  expired: { label: "Not paid", tone: "bg-slate-300/50 text-slate-600" },
  refunded: { label: "Cancelled, refund on the way", tone: "bg-rose-400/20 text-rose-700" },
};
