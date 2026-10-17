import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";

// Verification codes. 4 digits (1000 to 9999) so they are easy to read out or type; if a random 4-digit code keeps clashing
// (the shorter codes are nearly all used) it moves to 5 digits, then 6. A code is never reused.
const randomCode = (digits: number) => {
  const min = 10 ** (digits - 1);
  return String(min + Math.floor(Math.random() * 9 * min));
};

type NewDoc = Omit<Prisma.DocVerificationUncheckedCreateInput, "code">;

/** Creates the row with a free code. For a payment that already has a code, returns that one instead (never a second code). */
export async function createWithCode(data: NewDoc) {
  for (const digits of [4, 5, 6]) {
    const tries = digits === 4 ? 25 : 60;
    for (let i = 0; i < tries; i++) {
      try {
        return await prisma.docVerification.create({ data: { ...data, code: randomCode(digits) } });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
        const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
        if (target.includes("sourceType") || target.includes("sourceId")) {
          const existing = await prisma.docVerification.findFirst({ where: { sourceType: data.sourceType ?? undefined, sourceId: data.sourceId ?? undefined } });
          if (existing) return existing;
        }
        // the code was taken: draw another
      }
    }
  }
  throw new Error("No free verification code");
}

export type PaymentSource = "checkout" | "booking" | "gamezone";

/** The verification code of one paid record, made on first use. */
export async function ensurePaymentCode(sourceType: PaymentSource, sourceId: string, issuedBy?: string) {
  const found = await prisma.docVerification.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId } } });
  if (found) return found.code;
  return (await createWithCode({ kind: "payment", sourceType, sourceId, issuedBy: issuedBy ?? null })).code;
}

/** Codes for many paid records at once (the payment history): one query for the ones that exist, then the missing ones are made. */
export async function ensurePaymentCodes(items: { sourceType: PaymentSource; sourceId: string }[]) {
  const out = new Map<string, string>();
  if (items.length === 0) return out;
  const key = (t: string, id: string) => `${t}:${id}`;
  const rows = await prisma.docVerification.findMany({ where: { OR: items.map((i) => ({ sourceType: i.sourceType, sourceId: i.sourceId })) }, select: { sourceType: true, sourceId: true, code: true } });
  for (const r of rows) out.set(key(r.sourceType!, r.sourceId!), r.code);
  for (const i of items) if (!out.has(key(i.sourceType, i.sourceId))) out.set(key(i.sourceType, i.sourceId), await ensurePaymentCode(i.sourceType, i.sourceId));
  return out;
}
export const codeKey = (t: string, id: string) => `${t}:${id}`;
