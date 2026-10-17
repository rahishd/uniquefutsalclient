// Age from a date of birth (YYYY-MM-DD) and the Find Player age groups. All dates are Nepal calendar days
// (see utils/dates.ts), so an age never changes with the server's time zone.

export const MIN_AGE = 5; // youngest accepted at sign-up (children are registered by a guardian)
export const MAX_AGE = 100;

// "open" = anyone. A group is [from, to): "20-25" is 20 up to 24 years old, so a 20 year old is in "20-25" only.
export const AGE_GROUPS = ["open", "15-20", "20-25", "25-30", "30-35", "35-40", "40+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const isAgeGroup = (v: unknown): v is AgeGroup => typeof v === "string" && (AGE_GROUPS as readonly string[]).includes(v);

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const parts = (k: string) => { const m = KEY.exec(k); return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null; };
const realDate = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

/** Whole years between the birth date and `today` (both YYYY-MM-DD). */
export function ageOn(dob: string, today: string): number | null {
  const b = parts(dob), t = parts(today);
  if (!b || !t || !realDate(b.y, b.m, b.d)) return null;
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}

/** A real, past date that gives an age from MIN_AGE to MAX_AGE. */
export function isValidDob(dob: unknown, today: string): dob is string {
  if (typeof dob !== "string") return false;
  const a = ageOn(dob, today);
  return a !== null && a >= MIN_AGE && a <= MAX_AGE;
}

export function groupRange(g: AgeGroup): { from: number; to: number } | null {
  if (g === "open") return null;
  if (g === "40+") return { from: 40, to: Infinity };
  const [a, b] = g.split("-").map(Number);
  return { from: a, to: b };
}

export function inAgeGroup(dob: string | null | undefined, g: AgeGroup, today: string): boolean {
  if (g === "open") return true;
  if (!dob) return false;
  const age = ageOn(dob, today);
  const r = groupRange(g);
  return age !== null && r !== null && age >= r.from && age < r.to;
}

// The birth date a person of exactly `years` years would have today (29 Feb counts as 28 Feb in a year without one).
function yearsAgo(today: string, years: number): string {
  const t = parts(today)!;
  const y = t.y - years;
  const d = t.m === 2 && t.d === 29 && !realDate(y, 2, 29) ? 28 : t.d;
  return `${String(y).padStart(4, "0")}-${String(t.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Database filter for the people in a group: born on or before (today - from years) and after (today - to years). */
export function dobFilter(g: AgeGroup, today: string): { dateOfBirth?: { lte: string; gt?: string; not?: null } } {
  const r = groupRange(g);
  if (!r) return {};
  return { dateOfBirth: { lte: yearsAgo(today, r.from), ...(Number.isFinite(r.to) ? { gt: yearsAgo(today, r.to) } : {}) } };
}

// ---- several age groups on one request ----
// Stored as one text value: "open", or the chosen groups joined by commas (e.g. "20-25,30-35"). Old requests hold one group.
const ORDER = AGE_GROUPS.filter((g) => g !== "open") as AgeGroup[];
export function parseGroups(stored: string | null | undefined): AgeGroup[] {
  const list = (stored ?? "").split(",").map((s) => s.trim()).filter(isAgeGroup);
  if (list.length === 0 || list.includes("open")) return ["open"];
  return ORDER.filter((g) => list.includes(g));
}

/** Cleans what the customer picked: "open" wins, otherwise the groups in age order without repeats. */
export function normaliseGroups(picked: unknown[]): AgeGroup[] {
  const list = picked.filter(isAgeGroup);
  if (list.length === 0 || list.includes("open")) return ["open"];
  return ORDER.filter((g) => list.includes(g));
}

/** In at least one of the groups (Open: everyone). */
export function inAnyGroup(dob: string | null | undefined, groups: AgeGroup[], today: string): boolean {
  return groups.includes("open") || groups.some((g) => inAgeGroup(dob, g, today));
}

/** Database filter for people in any of the groups (Open: no filter). */
export function dobFilterAny(groups: AgeGroup[], today: string): { OR?: object[] } {
  if (groups.includes("open")) return {};
  return { OR: groups.map((g) => dobFilter(g, today)) };
}

/** "20 to 25 years, 30 to 35 years" style label for messages. */
export function groupsLabel(groups: AgeGroup[]): string {
  if (groups.includes("open")) return "Open";
  return groups.map((g) => (g === "40+" ? "40 and over" : g.replace("-", " to ")) + " years").join(", ");
}
