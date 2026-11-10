import SettingsService from "../settings/settings.service";
import { currentTime, todayKey } from "../../utils/dates";
import { FREE_PER_DAY, FREE_PER_WEEK, PERIODS, Period } from "../../utils/loyaltyPoints";

// When and how free games can be claimed, set by staff in the admin portal (Loyalty Points > Customized). Stored in Settings under this
// key as JSON. The server enforces it on every claim; the app only shows what the overview says. Times are Nepal time.
export const CLAIM_RULES_KEY = "loyaltyClaimRules";

export interface ClaimRules {
  enabled: boolean; // master switch for claiming free games
  perDay: number; // free games one customer can claim a day
  perWeek: number; // and in the last 7 days
  from: string; // claiming opens at this time of day, HH:MM
  to: string; // and closes at this time, HH:MM
  shifts: Period[]; // which shifts' free games can be claimed
  days: number[]; // weekdays claiming is active, 0 = Sunday ... 6 = Saturday
  overrides: Record<string, boolean>; // date -> true (on) / false (off), wins over the weekday list (the calendar)
}

export const DEFAULT_CLAIM_RULES: ClaimRules = {
  enabled: true, perDay: FREE_PER_DAY, perWeek: FREE_PER_WEEK, from: "00:00", to: "23:59", shifts: [...PERIODS], days: [0, 1, 2, 3, 4, 5, 6], overrides: {},
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const int = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 50 ? (v as number) : d);

export function normalizeClaimRules(j: Partial<ClaimRules> | null | undefined): ClaimRules {
  const d = DEFAULT_CLAIM_RULES;
  if (!j || typeof j !== "object") return d;
  const overrides: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(j.overrides ?? {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === "boolean") overrides[k] = v;
  return {
    enabled: j.enabled !== false,
    perDay: int(j.perDay, d.perDay),
    perWeek: int(j.perWeek, d.perWeek),
    from: typeof j.from === "string" && HHMM.test(j.from) ? j.from : d.from,
    to: typeof j.to === "string" && HHMM.test(j.to) ? j.to : d.to,
    shifts: Array.isArray(j.shifts) ? PERIODS.filter((p) => j.shifts!.includes(p)) : d.shifts,
    days: Array.isArray(j.days) ? [...new Set(j.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : d.days,
    overrides,
  };
}

export async function getClaimRules(): Promise<ClaimRules> {
  const v = await SettingsService.getSetting(CLAIM_RULES_KEY);
  if (!v) return DEFAULT_CLAIM_RULES;
  try { return normalizeClaimRules(JSON.parse(v) as Partial<ClaimRules>); } catch { return DEFAULT_CLAIM_RULES; }
}

const weekday = (key: string) => new Date(`${key}T00:00:00Z`).getUTCDay();

// Is claiming open right now, and if not, why (a sentence for the customer). `period` is checked only when given.
export function claimClosedReason(r: ClaimRules, now = new Date(), period?: Period): string | null {
  const today = todayKey(now);
  if (!r.enabled) return "Free game claims are paused right now.";
  const forced = r.overrides[today];
  if (forced === false) return "Free game claims are off today.";
  if (forced !== true && !r.days.includes(weekday(today))) return "Free games can't be claimed on this day of the week.";
  const t = currentTime(now);
  const inside = r.from <= r.to ? t >= r.from && t <= r.to : t >= r.from || t <= r.to; // a window past midnight is allowed
  if (!inside) return `Free games can be claimed between ${r.from} and ${r.to}.`;
  if (period && !r.shifts.includes(period)) return `Free ${period} games can't be claimed right now.`;
  return null;
}
