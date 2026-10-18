import { randomInt } from "crypto";
import { InsuranceClaim } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { savePhotos } from "../../utils/complaintMedia";
import { addDaysKey, isValidKey, todayKey } from "../../utils/dates";
import { MOBILE, maskPhone } from "../../utils/emergency";
import notificationService from "../notification/notification.service";

export const SEVERITIES = ["minor", "emergency"] as const;
export const CLAIM_STATUSES = ["submitted", "in_review", "approved", "rejected", "closed"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const DAYS_BACK = 30; // a claim must be filed within a month of the injury
export const PER_DAY = 3; // anti-spam: claims one customer can file in 24 hours
export const CALLS_PER_DAY = 10; // emergency-contact lookups one account can make in 24 hours
export const AMBULANCE = "102"; // Nepal ambulance

const DEVANAGARI = /[ऀ-ॿ]/;

// Short code the customer quotes ("IC-7K3QX9"); no 0/O/1/I so it is easy to read out.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "IC-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const tidy = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

export function view(c: InsuranceClaim) {
  return {
    id: c.id, code: c.code, patientName: c.patientName, patientPhone: c.patientPhone, witnessName: c.witnessName, witnessNameNe: c.witnessNameNe,
    witnessPhone: c.witnessPhone, severity: c.severity, incidentDate: c.incidentDate, description: c.description, photos: c.photos,
    status: c.status, staffReply: c.staffReply, createdAt: c.createdAt, decidedAt: c.decidedAt,
  };
}

export interface ClaimInput {
  patientName?: unknown; patientPhone?: unknown; witnessName?: unknown; witnessNameNe?: unknown; witnessPhone?: unknown;
  severity?: unknown; incidentDate?: unknown; description?: unknown; photos?: unknown;
}

export class InsuranceService {
  async create(userId: string, input: ClaimInput) {
    const patientName = tidy(input.patientName);
    if (patientName.length < 2 || patientName.length > NAME_MAX) throw new AppError(400, "Enter the name of the injured player.");
    const patientPhone = typeof input.patientPhone === "string" ? input.patientPhone.replace(/[\s-]/g, "") : "";
    if (!MOBILE.test(patientPhone)) throw new AppError(400, "Enter the injured player's 10-digit registered mobile number.");
    const patient = await prisma.user.findUnique({ where: { phoneNumber: patientPhone }, select: { phoneNumber: true, isActive: true } });
    if (!patient) throw new AppError(400, "That number has no Unique Futsal account. The injured player must be registered.");

    const witnessName = tidy(input.witnessName);
    if (witnessName.length < 2 || witnessName.length > NAME_MAX) throw new AppError(400, "Enter the witness's name.");
    const witnessNameNe = tidy(input.witnessNameNe);
    if (witnessNameNe.length < 2 || witnessNameNe.length > NAME_MAX || !DEVANAGARI.test(witnessNameNe)) {
      throw new AppError(400, "Enter the witness's name in Nepali (साक्षीको नाम नेपालीमा).");
    }
    let witnessPhone: string | null = null;
    if (typeof input.witnessPhone === "string" && input.witnessPhone.trim()) {
      witnessPhone = input.witnessPhone.replace(/[\s-]/g, "");
      if (!MOBILE.test(witnessPhone)) throw new AppError(400, "Enter the witness's 10-digit mobile number, or leave it empty.");
    }

    const severity = typeof input.severity === "string" ? input.severity : "";
    if (!(SEVERITIES as readonly string[]).includes(severity)) throw new AppError(400, "Choose the injury case: Minor or Emergency.");

    const today = todayKey();
    const incidentDate = isValidKey(input.incidentDate) ? input.incidentDate : "";
    if (!incidentDate) throw new AppError(400, "Choose the day of the injury.");
    if (incidentDate > today) throw new AppError(400, "The injury date cannot be in the future.");
    if (incidentDate < addDaysKey(today, -DAYS_BACK)) throw new AppError(400, `Claims must be filed within ${DAYS_BACK} days of the injury. Please contact the venue.`);

    const description = tidy(input.description);
    if (description.length > DESCRIPTION_MAX) throw new AppError(400, `Please keep the description under ${DESCRIPTION_MAX} characters.`);
    if (!Array.isArray(input.photos) || input.photos.length === 0) throw new AppError(400, "Add at least one photo of the incident or injury.");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.insuranceClaim.count({ where: { userId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can file up to ${PER_DAY} claims a day. Please try again tomorrow, or call the venue.`);
    }

    let code = makeCode();
    for (let i = 0; i < 5 && (await prisma.insuranceClaim.findUnique({ where: { code }, select: { id: true } })); i++) code = makeCode();
    const photos = await savePhotos(code, input.photos, "insurance");
    const row = await prisma.insuranceClaim.create({
      data: { code, userId, patientName, patientPhone, witnessName, witnessNameNe, witnessPhone, severity, incidentDate, description: description || null, photos },
    });
    // the injured player hears about it too when someone else filed it for them
    if (patientPhone !== userId) {
      await notificationService.notify({ userId: patientPhone, type: "insurance", title: "An insurance claim was filed for you", message: `Claim ${code} for your injury on ${incidentDate}. The venue will review it.`, href: "/insurance" });
    }
    return view(row);
  }

  // Claims this customer filed, plus claims filed for them by someone else.
  async mine(userId: string) {
    const rows = await prisma.insuranceClaim.findMany({ where: { OR: [{ userId }, { patientPhone: userId }] }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((r) => ({ ...view(r), filedByMe: r.userId === userId }));
  }

  // "Slide to call": the emergency contact saved on the injured player's account. Only for signed-in customers, limited
  // per day, and every lookup is logged. The full number goes to the phone's dialer; the screen shows it masked.
  async emergencyContact(callerId: string, patientPhoneRaw: unknown) {
    const patientPhone = typeof patientPhoneRaw === "string" ? patientPhoneRaw.replace(/[\s-]/g, "") : "";
    if (!MOBILE.test(patientPhone)) throw new AppError(400, "Enter the injured player's 10-digit registered mobile number.");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.emergencyCall.count({ where: { callerId, createdAt: { gte: since } } })) >= CALLS_PER_DAY) {
      throw new AppError(429, `Too many emergency lookups today. Call ${AMBULANCE} for an ambulance, or call the venue.`);
    }
    const u = await prisma.user.findUnique({ where: { phoneNumber: patientPhone }, select: { name: true, emergencyName: true, emergencyPhone: true, emergencyRelation: true } });
    if (!u) throw new AppError(404, "That number has no Unique Futsal account.");
    const found = !!u.emergencyPhone;
    await prisma.emergencyCall.create({ data: { callerId, patientPhone, found } });
    return {
      patientName: u.name ?? null,
      contact: found ? { name: u.emergencyName ?? "Emergency contact", relation: u.emergencyRelation, phone: u.emergencyPhone!, masked: maskPhone(u.emergencyPhone!) } : null,
      ambulance: AMBULANCE,
    };
  }

  /* ---------- staff ---------- */

  async adminList(status?: string, page = 1, limit = 25) {
    const where = status && (CLAIM_STATUSES as readonly string[]).includes(status) ? { status } : {};
    const [rows, total] = await Promise.all([
      prisma.insuranceClaim.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: (page - 1) * limit }),
      prisma.insuranceClaim.count({ where }),
    ]);
    return { items: rows.map((r) => ({ ...view(r), userId: r.userId })), total, page, limit };
  }

  // Staff set the status and/or write a reply; the filer (and the patient, if someone else) is told in the app.
  async adminUpdate(staffId: string, id: string, input: { status?: string; reply?: string }) {
    const c = await prisma.insuranceClaim.findUnique({ where: { id } });
    if (!c) throw new AppError(404, "Claim not found");
    if (input.status !== undefined && !(CLAIM_STATUSES as readonly string[]).includes(input.status)) throw new AppError(400, "Unknown status");
    const reply = input.reply?.trim();
    if (reply !== undefined && reply.length > 1000) throw new AppError(400, "Keep the reply under 1000 characters.");
    const status = (input.status ?? c.status) as ClaimStatus;
    const decided = status === "approved" || status === "rejected" || status === "closed";
    const upd = await prisma.insuranceClaim.update({
      where: { id },
      data: { status, ...(reply ? { staffReply: reply, repliedBy: staffId } : {}), decidedAt: decided ? c.decidedAt ?? new Date() : null },
    });
    const changed = status !== c.status || (!!reply && reply !== c.staffReply);
    if (changed) {
      const text = reply ? `The venue replied: ${reply.slice(0, 120)}${reply.length > 120 ? "…" : ""}` : `Status: ${status.replace("_", " ")}.`;
      for (const userId of new Set([c.userId, c.patientPhone])) {
        await notificationService.notify({ userId, type: "insurance", title: `Update on insurance claim ${c.code}`, message: text, href: "/insurance" });
      }
    }
    return view(upd);
  }
}

export default new InsuranceService();
