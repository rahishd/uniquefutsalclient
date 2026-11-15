import { prisma } from "../config/db";

// The wording of the customer's texts. Staff edit it in the admin portal (SMS page); it is saved in Settings under "smsTemplates" as JSON
// ({ key: text }). A key with no saved text uses the default below. The admin portal keeps its own copy of KEYS and DEFAULTS
// (uniquefutsaladmin/server/src/modules/sms.ts): change both together.
//
// Placeholders are written {name}. Only the ones listed for a key are filled in; the rest stay as they are.
export const SMS_KEYS = ["booking_requested", "booking_confirmed", "booking_cancelled", "otp", "reminder"] as const;
export type SmsKey = (typeof SMS_KEYS)[number];

export const SMS_DEFAULTS: Record<SmsKey, string> = {
  booking_requested: "Dear {name}, we received your booking request for {time} on {date}. It is awaiting confirmation from Unique Futsal; we will text you once it is confirmed. Code {code}.",
  booking_confirmed: "Dear {name}, your booking is confirmed for {time} on {date}.{due} Please arrive 10 minutes early. Code {code}. - Unique Futsal",
  booking_cancelled: "Dear {name}, your booking scheduled for {time} on {date} has been cancelled. If this was unintentional, please contact us or rebook your slot anytime. Thank you for choosing Unique Futsal.",
  otp: "{otp} is your Unique Futsal code. It works for 10 minutes. Do not share it with anyone.",
  reminder: "Reminder: your game starts in 1 hour (@{time}). See you at Unique Futsal!",
};

const TTL_MS = 30 * 1000;
let cache: { at: number; map: Partial<Record<SmsKey, string>> } | null = null;

async function saved(): Promise<Partial<Record<SmsKey, string>>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  let map: Partial<Record<SmsKey, string>> = {};
  try {
    const row = await prisma.settings.findUnique({ where: { key: "smsTemplates" } });
    if (row?.value) {
      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      for (const k of SMS_KEYS) if (typeof parsed[k] === "string" && (parsed[k] as string).trim()) map[k] = (parsed[k] as string).trim();
    }
  } catch {
    map = {}; // a broken setting never stops a text: the defaults are used
  }
  cache = { at: Date.now(), map };
  return map;
}

export function clearSmsTemplateCache() {
  cache = null;
}

/** The text for a key with its placeholders filled in. {due} and the like that are empty simply vanish. */
export async function renderSms(key: SmsKey, vars: Record<string, string | number | null | undefined>): Promise<string> {
  const body = (await saved())[key] ?? SMS_DEFAULTS[key];
  return body.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name] ?? "") : whole)).replace(/ {2,}/g, " ").trim();
}
