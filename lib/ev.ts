// EV Charging (Quick Access > EV Charging): scan the QR at a charging port to start, stop when done, and see the charging and
// payment history. Paid AC charging, Rs. 50 an hour, billed by started quarter hours. The server decides everything: the port, the
// price and the bill (see backend docs/API.md, "EV charging"). Payment is made at the venue.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface EvSession {
  id: string;
  status: "charging" | "unpaid" | "paid" | "cancelled";
  port: string | null;
  startedAt: string | null;
  endedAt: string | null;
  minutes: number;
  rate: number;
  amount: number;
  paidAt: string | null;
  source: "app" | "staff";
}

export interface EvMe {
  rate: number;
  blockMinutes: number;
  active: EvSession | null;
  history: EvSession[];
  owed: number;
}

export const evStore = createRemoteStore<EvMe | null>(() => api<EvMe>("/ev/me"), { pollMs: 10000, signedOut: null });

export const startCharging = (code: string) => api<EvSession>("/ev/start", { method: "POST", body: { code } });
export const stopCharging = (id: string) => api<EvSession & { warning: string | null }>(`/ev/${id}/stop`, { method: "POST" });

// The same rule the server uses, only to show a running estimate while charging.
export const estimate = (minutes: number, rate: number, block = 15) => Math.ceil((Math.ceil(Math.max(1, minutes) / block) * rate) / (60 / block));

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

// "ev?port=TOKEN" in the page address (the QR holds a link) or a scanned/typed code
export function portFromAddress(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("port")?.trim() ?? "";
}
