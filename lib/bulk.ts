// Bulk Booking: up to 5 one-hour games a week (10 per booking), in the next 7 days, booked and paid together with ONE Fonepay payment
// (50% advance, the rest at the venue, or the full amount). The server prices every hour on its own: a promo code
// applies only to the hours it is valid for. See backend/src/modules/booking/booking.bulk.ts.

import { api } from "@/lib/api";
import type { PaymentOrder } from "@/lib/payment";

export const BULK_MAX_HOURS = 10;
export const BULK_WINDOW_DAYS = 7; // today .. today + 7
export const BULK_MAX_PER_WEEK = 5; // bulk games one customer can hold in a calendar week (Monday to Sunday)

/** The Monday (YYYY-MM-DD) of the week a date falls in. */
export function weekStartOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dt = new Date(Date.UTC(y, m - 1, d - ((day + 6) % 7)));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export interface BulkAllowance { limit: number; used: Record<string, number> }
export const fetchBulkAllowance = () => api<BulkAllowance>("/bookings/bulk/allowance");
export const BULK_ADVANCE_PERCENT = 50;

export type BulkMode = "advance" | "full";
export interface BulkSlot { date: string; startTime: string }

// A public promo code that would save money on the picked hours (the server tries it on every hour and returns the best few).
export interface BulkPromoTip { code: string; label: string; discount: number; total: number; hours: number; best: boolean }

export interface BulkQuote {
  slots: (BulkSlot & { basePrice: number; discount: number; total: number; promoApplied: boolean })[];
  subtotal: number;
  discount: number;
  total: number;
  advance: number; // what is paid now with the 50% option
  advancePercent: number;
  promo: { code: string; ok: boolean; appliedTo: number; message: string | null } | null;
  suggestions: BulkPromoTip[];
}

export interface BulkResult {
  code: string; // BLK-XXXXXX, the code of the whole bulk booking
  mode: BulkMode;
  total: number;
  payNow: number;
  restAtVenue: number;
  bookings: string[];
  payment: PaymentOrder;
}

export const bulkAmount = (total: number, mode: BulkMode) => (mode === "full" ? total : Math.round((total * BULK_ADVANCE_PERCENT) / 100));

export const fetchBulkQuote = (slots: BulkSlot[], promoCode?: string) =>
  api<BulkQuote>("/bookings/bulk/quote", { method: "POST", body: { slots, promoCode: promoCode || undefined } });

export const createBulkBooking = (p: { slots: BulkSlot[]; mode: BulkMode; promoCode?: string }) =>
  api<BulkResult>("/bookings/bulk", { method: "POST", body: { ...p, method: "fonepay", promoCode: p.promoCode || undefined } });
