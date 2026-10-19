// Bulk Booking: up to 10 one-hour games in the next 7 days, booked and paid together with ONE Fonepay payment
// (50% advance, the rest at the venue, or the full amount). The server prices every hour on its own: a promo code
// applies only to the hours it is valid for. See backend/src/modules/booking/booking.bulk.ts.

import { api } from "@/lib/api";
import type { PaymentOrder } from "@/lib/payment";

export const BULK_MAX_HOURS = 10;
export const BULK_WINDOW_DAYS = 7; // today .. today + 7
export const BULK_ADVANCE_PERCENT = 50;

export type BulkMode = "advance" | "full";
export interface BulkSlot { date: string; startTime: string }

export interface BulkQuote {
  slots: (BulkSlot & { basePrice: number; discount: number; total: number; promoApplied: boolean })[];
  subtotal: number;
  discount: number;
  total: number;
  advance: number; // what is paid now with the 50% option
  advancePercent: number;
  promo: { code: string; ok: boolean; appliedTo: number; message: string | null } | null;
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
