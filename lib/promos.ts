// Promo codes shown to customers (Home strip and the /promos page), from the server (GET /promos).
// The server owns the codes, dates, eligibility and discount, and checks a code again when a booking is made.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import { parseKey } from "@/lib/booking";

export interface Promo {
  code: string;
  title: string;
  description: string;
  discount: string; // "15% OFF"
  kind: "booking" | "membership";
  until: string | null; // last valid day, YYYY-MM-DD
  daysLeft: number | null;
  terms: string;
  status: "active" | "expired";
  // the limits staff set on the code (all optional): first N customers and how many are left, uses each, slot hours, weekdays
  maxUses?: number | null;
  usesLeft?: number | null;
  maxPerCustomer?: number | null;
  slotFrom?: string | null;
  slotTo?: string | null;
  validDays?: string[];
}

export const promosStore = createRemoteStore<Promo[]>(() => api<Promo[]>("/promos", { auth: "none" }));

export function fmtDay(key: string) {
  return parseKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
