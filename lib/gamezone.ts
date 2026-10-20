// Gamezone (PS5): consoles, games, rates, free times and bookings all come from the server
// (see uniquefutsal-backend/docs/API.md). Price is rate x players x hours; the server sets the final price.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import type { PayMethod, PaymentOrder } from "@/lib/payment";

export interface Catalog {
  consoles: { id: string; name: string }[];
  games: { id: string; title: string }[];
  plans: { players: number; label: string; ratePerPersonHour: number }[];
  maxHours: number;
  openHour: number;
  closeHour: number;
}

export const catalogStore = createRemoteStore<Catalog>(() => api<Catalog>("/gamezone/catalog", { auth: "none" }));

// Only for showing a price before booking; the server calculates the real one.
export const estimate = (rate: number, players: number, hours: number) => rate * players * hours;

// Start hours where THIS console is free for every hour of the session (each console has its own bookings).
export async function fetchGzSlots(date: string, hours: number, consoleId: string): Promise<number[]> {
  const r = await api<{ hours: number[] }>("/gamezone/slots", { query: { date, hours, consoleId }, auth: "none" });
  return r.hours;
}

export interface GzBooking {
  code: string;
  console: string;
  consoleId: string;
  game: string;
  date: string;
  startHour: number;
  hours: number;
  players: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string; // pending | pay_at_venue | paid
  status: string; // confirmed | completed | cancelled | expired
  clock?: GzClock | null; // null until staff press Start
}

// The live clock staff start at the venue: the booked hours run, and minutes after that are charged per minute (the server makes the final bill).
export interface GzClock {
  startedAt: string;
  endedAt: string | null; // set when staff stop the session
  bookedMinutes: number;
  hourlyRate: number; // Rs per hour for the whole session
  extraMinutes: number; // final, once stopped
  extraCharge: number;
  now: string; // the server time when this was sent
  skewMs: number; // server time minus this device time, so the countdown is right even if the phone clock is off
}

export interface GzCheckout {
  booking: GzBooking;
  payment: PaymentOrder | null;
}

export function bookGamezone(p: {
  date: string;
  hour: number;
  hours: number;
  players: number;
  consoleId: string;
  game: string;
  method: PayMethod;
  guest?: { name: string; phone: string };
}): Promise<GzCheckout> {
  return api<GzCheckout>("/gamezone/bookings", { method: "POST", body: p });
}

// Reloads every 20 seconds while a page shows it, so a session staff just started (or stopped) appears without leaving the page.
async function loadMine(): Promise<GzBooking[]> {
  const rows = await api<GzBooking[]>("/gamezone/bookings/me");
  const device = Date.now();
  return rows.map((b) => (b.clock ? { ...b, clock: { ...b.clock, skewMs: Date.parse(b.clock.now) - device } } : b));
}
export const myGzStore = createRemoteStore<GzBooking[]>(loadMine, { signedOut: [], pollMs: 20000 });

export async function cancelGz(code: string) {
  await api(`/gamezone/bookings/${encodeURIComponent(code)}/cancel`, { method: "POST" });
  await myGzStore.refresh();
}
