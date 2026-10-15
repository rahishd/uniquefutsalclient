// Unique Goal Rush: how one penalty kick turns out. Pure functions, no database.
//
// The goal mouth is measured in "goal units": x = -1 (left post) .. 1 (right post), y = 0 (ground) .. 1 (crossbar).
// The player chooses where to aim and how hard to shoot. The SERVER then decides everything else:
//   1. Accuracy: the harder the shot, the further the ball can stray from the aim (a power shot into the corner can go wide).
//   2. The goalkeeper picks a zone (3 columns x 2 rows). He reads the shot sometimes and guesses otherwise.
//   3. In the zone he dived to he usually saves; a fast or corner shot is harder to stop; in a next-door zone he can still
//      get a fingertip to it; anywhere else it is a goal.
// The customer app has a copy of this file only to play the practice mode; a reward-earning game is always played here.

export type Zone = "TL" | "TC" | "TR" | "BL" | "BC" | "BR";
export type Outcome = "goal" | "save" | "wide" | "over" | "post";

export interface ShotInput {
  aimX: number;
  aimY: number;
  power: number; // 0..1
}

export interface ShotResult {
  outcome: Outcome;
  ballX: number; // where the ball ended up (goal units)
  ballY: number;
  keeper: Zone; // the zone the goalkeeper dived to
}

export const AIM_X = 1.3; // the aim may go a little outside the posts ...
export const AIM_Y = 1.25; // ... and over the bar
const POST = 0.09; // thickness of a post / the crossbar in goal units
export const ZONES: Zone[] = ["TL", "TC", "TR", "BL", "BC", "BR"];

// Goalkeeper difficulty: how often he reads the shot correctly (1 easy .. 3 hard)
const READ: Record<1 | 2 | 3, number> = { 1: 0.25, 2: 0.35, 3: 0.45 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function clampShot(s: ShotInput): ShotInput {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    aimX: clamp(num(s.aimX, 0), -AIM_X, AIM_X),
    aimY: clamp(num(s.aimY, 0.3), 0, AIM_Y),
    power: clamp(num(s.power, 0.5), 0, 1),
  };
}

export function zoneOf(x: number, y: number): Zone {
  const col = x < -0.34 ? "L" : x > 0.34 ? "R" : "C";
  return `${y >= 0.5 ? "T" : "B"}${col}` as Zone;
}

// Where the keeper's gloves end up for each zone (used by the app to draw the dive)
export const ZONE_CENTER: Record<Zone, { x: number; y: number }> = {
  TL: { x: -0.68, y: 0.72 }, TC: { x: 0, y: 0.8 }, TR: { x: 0.68, y: 0.72 },
  BL: { x: -0.7, y: 0.22 }, BC: { x: 0, y: 0.25 }, BR: { x: 0.7, y: 0.22 },
};

function adjacent(a: Zone, b: Zone): boolean {
  if (a === b) return false;
  const col = (z: Zone) => "LCR".indexOf(z[1]);
  const sameRow = a[0] === b[0];
  const sameCol = a[1] === b[1];
  return (sameRow && Math.abs(col(a) - col(b)) === 1) || sameCol;
}

// Standard normal number from two uniform ones (Box-Muller)
function gauss(rng: () => number): number {
  let u = 0;
  while (u <= 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** The chance the keeper saves an on-target shot, given where he dived. */
export function saveChance(ball: { x: number; y: number }, power: number, keeper: Zone): number {
  const shotZone = zoneOf(ball.x, ball.y);
  const ax = Math.abs(ball.x);
  let p: number;
  if (keeper === shotZone) {
    p = 0.9 - 0.38 * power;
    if (ax > 0.75 && ball.y > 0.7) p -= 0.15; // top corner
    else if (ax > 0.75 && ball.y < 0.25) p -= 0.08; // bottom corner
  } else if (adjacent(keeper, shotZone)) {
    p = Math.max(0.04, 0.24 - 0.12 * power);
  } else {
    p = 0;
  }
  if (power < 0.2) p += 0.12; // a weak shot gives him time
  return clamp(p, 0, 0.95);
}

export function resolveShot(input: ShotInput, rng: () => number, level: 1 | 2 | 3 = 2): ShotResult {
  const s = clampShot(input);
  // accuracy: the ball strays more the harder it is struck
  const bx = s.aimX + gauss(rng) * (0.03 + 0.2 * s.power);
  const by = Math.max(0, s.aimY + gauss(rng) * (0.03 + 0.15 * s.power));
  // the keeper commits to a zone: sometimes he reads the kick, otherwise he guesses
  const shotZone = zoneOf(clamp(bx, -1, 1), clamp(by, 0, 1));
  const keeper = rng() < READ[level] ? shotZone : ZONES[Math.min(5, Math.floor(rng() * 6))];
  const ax = Math.abs(bx);

  let outcome: Outcome;
  if (by > 1 + POST) outcome = "over";
  else if (ax > 1 + POST) outcome = "wide";
  else if (by > 1 || ax > 1) outcome = "post"; // hit the woodwork
  else outcome = rng() < saveChance({ x: bx, y: by }, s.power, keeper) ? "save" : "goal";

  return { outcome, ballX: r3(bx), ballY: r3(by), keeper };
}

/** A result with a chosen outcome (tests only): a plausible ball position and keeper dive for that outcome. */
export function forcedResult(input: ShotInput, outcome: Outcome): ShotResult {
  const s = clampShot(input);
  const zone = zoneOf(clamp(s.aimX, -1, 1), clamp(s.aimY, 0, 1));
  const other = ZONES.find((z) => z !== zone && !adjacent(z, zone)) ?? "TL";
  if (outcome === "goal") return { outcome, ballX: r3(clamp(s.aimX, -0.9, 0.9)), ballY: r3(clamp(s.aimY, 0.05, 0.9)), keeper: other };
  if (outcome === "save") return { outcome, ballX: r3(clamp(s.aimX, -0.9, 0.9)), ballY: r3(clamp(s.aimY, 0.05, 0.9)), keeper: zone };
  if (outcome === "over") return { outcome, ballX: r3(clamp(s.aimX, -0.9, 0.9)), ballY: 1.2, keeper: other };
  if (outcome === "post") return { outcome, ballX: 1.04, ballY: 0.5, keeper: other };
  return { outcome, ballX: 1.25, ballY: 0.4, keeper: other };
}
