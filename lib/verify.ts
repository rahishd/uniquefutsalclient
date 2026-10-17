// Verify Documents: type the code printed on a bill or document to see whether Unique Futsal really issued it.
// Public (no sign-in): a school, bank or company can check a bill a customer hands over. A wrong code is a 404.

import { api, ApiError } from "@/lib/api";

export interface BillLine {
  type: string;
  label: string;
  quantity: number;
  amount: number;
}

export interface VerifiedPayment {
  genuine: true;
  kind: "payment";
  code: string;
  issuedBy: string;
  issuedAt: string;
  bill: {
    reference: string;
    type: "bill" | "game" | "gamezone";
    customer: string; // shortened: "Rahish D."
    date: string;
    time: string | null;
    lines: BillLine[];
    total: number;
    method: string;
    status: string;
    payments: { method: string; amount: number }[];
  };
}

export interface VerifiedDocument {
  genuine: true;
  kind: "document";
  code: string;
  issuedBy: string;
  issuedAt: string;
  document: { title: string; issuedTo: string | null; orgType: string | null; details: string | null; photos: string[] };
}

export type Verified = VerifiedPayment | VerifiedDocument;

export type VerifyResult = { ok: true; data: Verified } | { ok: false; reason: "fake" | "locked" | "error"; message: string };

/** Asks the server. "Fake" means no genuine bill or document has this code; it is not an error of the app. */
export async function verifyCode(code: string): Promise<VerifyResult> {
  try {
    return { ok: true, data: await api<Verified>("/verify", { method: "POST", body: { code }, auth: "none" }) };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) return { ok: false, reason: "fake", message: e.message };
      if (e.status === 429) return { ok: false, reason: "locked", message: e.message };
      return { ok: false, reason: "error", message: e.message };
    }
    return { ok: false, reason: "error", message: "Could not check the code. Please try again." };
  }
}

export const ORG_LABEL: Record<string, string> = { school: "School", college: "College", bank: "Bank", company: "Company", other: "Organisation" };
