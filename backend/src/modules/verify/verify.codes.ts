import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";

// Verification codes. A code is never reused.
// New codes are 5 characters: digits and capital letters mixed, like 1234A (no I or O, so they are not mistaken for 1 and 0).
// Older all-digit codes (4 to 6 digits) keep working. If every 5-character code that is drawn keeps clashing, it moves to 6.
const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const randomCode = (len: number) => {
  for (;;) {
    let c = "";
    for (let i = 0; i < len; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (/[0-9]/.test(c) && /[A-Z]/.test(c)) return c;
  }
};

type NewDoc = Omit<Prisma.DocVerificationUncheckedCreateInput, "code">;

/** Creates the row with a free code. For a payment that already has a code, returns that one instead (never a second code). */
export async function createWithCode(data: NewDoc) {
  for (const digits of [5, 6]) {
    const tries = digits === 5 ? 60 : 100;
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
