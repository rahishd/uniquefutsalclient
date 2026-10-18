import { AppError } from "../middlewares/error.middleware";

// The emergency contact on a customer account: who the venue (or a teammate, by "slide to call") rings if the player
// is hurt. Asked at sign-up; customers who skipped it (older accounts, Google sign-in) are reminded in the app.

export const MOBILE = /^9\d{9}$/;
export const NAME_MAX = 80;
export const RELATION_MAX = 40;

export interface EmergencyContact {
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string | null;
}

// Checks and tidies an emergency contact. `ownPhone` is the account's own number, which can never be its own contact.
export function cleanEmergency(input: { emergencyName?: unknown; emergencyPhone?: unknown; emergencyRelation?: unknown }, ownPhone: string): EmergencyContact {
  const name = typeof input.emergencyName === "string" ? input.emergencyName.trim().replace(/\s+/g, " ") : "";
  const phone = typeof input.emergencyPhone === "string" ? input.emergencyPhone.replace(/[\s-]/g, "") : "";
  const relation = typeof input.emergencyRelation === "string" ? input.emergencyRelation.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > NAME_MAX) throw new AppError(400, "Enter the name of your emergency contact.");
  if (!MOBILE.test(phone)) throw new AppError(400, "Enter a 10-digit emergency mobile number starting with 9.");
  if (phone === ownPhone) throw new AppError(400, "Your emergency contact must be someone else's number, not your own.");
  if (relation.length > RELATION_MAX) throw new AppError(400, `Keep the relation under ${RELATION_MAX} characters.`);
  return { emergencyName: name, emergencyPhone: phone, emergencyRelation: relation || null };
}

// "98•••••678": enough to recognise the number on screen without showing all of it.
export const maskPhone = (p: string) => `${p.slice(0, 2)}${"•".repeat(Math.max(0, p.length - 5))}${p.slice(-3)}`;
