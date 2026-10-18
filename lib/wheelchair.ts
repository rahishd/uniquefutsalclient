// Wheelchair requests (Quick Access > Wheelchair Request). A customer tells the venue they are coming with a wheelchair
// so staff can get the ramp, a court-side space and help ready. The server checks everything again (see backend docs/API.md).

import { api } from "@/lib/api";

export type WheelchairStatus = "pending" | "confirmed" | "completed" | "declined" | "cancelled";

export interface WheelchairRequest {
  id: string;
  code: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  people: number;
  note: string | null;
  bookingCode: string | null;
  status: WheelchairStatus;
  staffReply: string | null;
  createdAt: string;
}

export interface WheelchairOptions {
  maxPeople: number;
  noteMax: number;
  daysAhead: number;
  perDay: number;
}

// Shown while the options load, or if the server cannot be reached; the server's values win once they arrive.
export const FALLBACK_OPTIONS: WheelchairOptions = { maxPeople: 10, noteMax: 500, daysAhead: 60, perDay: 3 };

export const STATUS_TEXT: Record<WheelchairStatus, { label: string; tone: string }> = {
  pending: { label: "Waiting for the venue", tone: "bg-amber-400/25 text-amber-700" },
  confirmed: { label: "Confirmed", tone: "bg-emerald-400/25 text-emerald-700" },
  completed: { label: "Done", tone: "bg-slate-300/50 text-slate-600" },
  declined: { label: "Could not be arranged", tone: "bg-rose-400/20 text-rose-700" },
  cancelled: { label: "Cancelled", tone: "bg-slate-300/50 text-slate-500" },
};

export const loadOptions = () => api<WheelchairOptions>("/wheelchair/options", { auth: "none" });
export const loadMine = () => api<WheelchairRequest[]>("/wheelchair/me");
export const sendRequest = (body: { date: string; time: string; people: number; note?: string; bookingCode?: string }) =>
  api<WheelchairRequest>("/wheelchair", { method: "POST", body });
export const cancelRequest = (id: string) => api<WheelchairRequest>(`/wheelchair/${encodeURIComponent(id)}/cancel`, { method: "POST" });
