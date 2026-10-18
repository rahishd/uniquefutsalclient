// Insurance claims (Quick Access > Claim Insurance). The server checks everything again: the patient must be a
// registered account, the witness name must be written in Nepali, the photos are decoded and re-encoded, and how many
// claims one customer may file a day (see backend docs/API.md).

import { api } from "@/lib/api";
export { photoUrl, shrinkPhoto } from "@/lib/complaints";

export type Severity = "minor" | "emergency";
export type ClaimStatus = "submitted" | "in_review" | "approved" | "rejected" | "closed";

export interface InsuranceOptions {
  severities: Severity[];
  maxPhotos: number;
  descriptionMax: number;
  daysBack: number;
  perDay: number;
  ambulance: string;
}

export interface InsuranceClaim {
  id: string;
  code: string;
  patientName: string;
  patientPhone: string;
  witnessName: string;
  witnessNameNe: string;
  witnessPhone: string | null;
  severity: Severity;
  incidentDate: string;
  description: string | null;
  photos: string[];
  status: ClaimStatus;
  staffReply: string | null;
  createdAt: string;
  decidedAt: string | null;
  filedByMe: boolean;
}

export interface EmergencyLookup {
  patientName: string | null;
  contact: { name: string; relation: string | null; phone: string; masked: string } | null;
  ambulance: string;
}

// Shown while the options load, or if the server cannot be reached; the server's values win once they arrive.
export const FALLBACK_OPTIONS: InsuranceOptions = { severities: ["minor", "emergency"], maxPhotos: 3, descriptionMax: 1000, daysBack: 30, perDay: 3, ambulance: "102" };

export const STATUS_TEXT: Record<ClaimStatus, { label: string; tone: string }> = {
  submitted: { label: "Received", tone: "bg-amber-400/25 text-amber-700" },
  in_review: { label: "Being reviewed", tone: "bg-sky-400/25 text-sky-700" },
  approved: { label: "Approved", tone: "bg-emerald-400/25 text-emerald-700" },
  rejected: { label: "Not approved", tone: "bg-rose-400/25 text-rose-700" },
  closed: { label: "Closed", tone: "bg-slate-300/50 text-slate-600" },
};

// Devanagari letters: the witness name in Nepali must use them (the server checks the same).
export const hasNepali = (s: string) => /[ऀ-ॿ]/.test(s);

export const loadOptions = () => api<InsuranceOptions>("/insurance/options", { auth: "none" });
export const loadMyClaims = () => api<InsuranceClaim[]>("/insurance/me");
export const fileClaim = (body: {
  patientName: string; patientPhone: string; witnessName: string; witnessNameNe: string; witnessPhone?: string;
  severity: Severity; incidentDate: string; description?: string; photos: string[];
}) => api<InsuranceClaim>("/insurance", { method: "POST", body });
// The emergency contact saved on the injured player's account (every lookup is logged by the server).
export const lookupEmergency = (patientPhone: string) => api<EmergencyLookup>("/insurance/emergency-contact", { method: "POST", body: { patientPhone } });
