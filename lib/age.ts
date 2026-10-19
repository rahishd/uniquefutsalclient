// Date of birth helpers for the sign-up form, the profile and Find Player. The server checks everything again.

export const MIN_AGE = 5;
export const MAX_AGE = 100;

/** The Find Player age groups, in the order they are shown. "open" = anyone can join. */
export const AGE_GROUPS = ["open", "15-20", "20-25", "25-30", "30-35", "35-40", "40+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** The age group with the most players, tagged "Most active" in Find Player. */
export const MOST_ACTIVE_GROUP = "20-25";

export const ageGroupLabel = (g: string) => (g === "open" ? "Open" : g === "40+" ? "40+" : g);
/** A request's groups as one label: "Open", "20 to 25 years", "20 to 25 years or 30 to 35 years". */
export const groupsText = (groups: string[]) => {
  if (groups.length === 0 || groups.includes("open")) return "Open";
  // groups that touch are joined: 30-35 and 35-40 read as "30-40 years"
  const spans = groups
    .map((g) => (g === "40+" ? [40, Infinity] : g.split("-").map(Number)) as [number, number])
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((out, [lo, hi]) => {
      const last = out[out.length - 1];
      if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
      else out.push([lo, hi]);
      return out;
    }, []);
  return spans.map(([lo, hi]) => (hi === Infinity ? `${lo}+ years` : `${lo}-${hi} years`)).join(" or ");
};

export const ageGroupHint = (g: string) => (g === "open" ? "Anyone can join" : `Players aged ${g === "40+" ? "40 and over" : g.replace("-", " to ")}`);

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The birth date (YYYY-MM-DD) of someone who is exactly `years` old today. Used as min / max of a date field. */
export function dobKey(years: number): string {
  const now = new Date();
  return key(new Date(now.getFullYear() - years, now.getMonth(), now.getDate()));
}

/** Whole years since the birth date, or null when it is not a real date. */
export function ageOf(dob: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(y, mo - 1, d);
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

export const dobOk = (dob: string) => {
  const a = ageOf(dob);
  return a !== null && a >= MIN_AGE && a <= MAX_AGE;
};
