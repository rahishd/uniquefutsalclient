// Payment helpers shared by court bookings and Gamezone.
//
// The customer pays the venue's one fixed Fonepay QR (public/fonepay-qr.png) for the exact amount and writes the short booking code as the
// remark. The server creates the order; only staff can mark it paid (they see the payment in the Fonepay app and confirm it in the admin
// portal). The browser just shows the QR and asks the server for the status every few seconds.

import { api } from "@/lib/api";

export type PayMethod = "fonepay" | "venue";
export type OnlineMethod = Exclude<PayMethod, "venue">;

export const PAY_METHODS: { id: PayMethod; label: string; note: string }[] = [
  { id: "fonepay", label: "Fonepay", note: "Scan the venue QR" },
  { id: "venue", label: "Pay at venue", note: "Cash or QR on arrival" },
];

// "esewa" is only for old records made before it was removed
export const METHOD_LABEL: Record<string, string> = { fonepay: "Fonepay", venue: "Pay at venue", esewa: "eSewa (old)" };

export const isOnline = (m: PayMethod): m is OnlineMethod => m !== "venue";

// How often the open payment screen asks the server whether the order has been paid.
export const PAYMENT_POLL_MS = 3000;

// What the server returns when it creates a payment order.
export interface PaymentOrder {
  orderCode: string;
  method: OnlineMethod;
  amount: number;
  remarks: string; // the short booking code to write as the Fonepay remark
  expiresAt: string; // ISO time the held slot runs out
}

export type PaymentStatus = "pending" | "paid" | "expired";

// A guest has no account, so the server matches the order to the phone number they gave.
export async function fetchPaymentStatus(orderCode: string, guestPhone?: string): Promise<PaymentStatus> {
  try {
    const r = await api<{ status: string }>(`/payments/${encodeURIComponent(orderCode)}/status`, { query: { phone: guestPhone } });
    return r.status === "paid" ? "paid" : r.status === "expired" ? "expired" : "pending";
  } catch {
    return "pending"; // a network blip: keep waiting, the next check tries again
  }
}
