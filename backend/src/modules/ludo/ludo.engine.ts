// Unique Ludo: the rules engine. Pure functions, no database, no clock, no randomness of its own
// (the dice value is always passed in), so every rule can be tested alone and the server stays the only
// place a result is decided. The browser never runs this to decide anything; it only draws what the server sends.
//
// Board: a 52-square shared track, four colours that start 13 squares apart, five home-lane squares per colour
// and a final home. A token position is a single number counted from ITS OWN start square:
//   -1        in the yard (base)
//   0 .. 50   on the shared track, 0 = the colour start square (the token has walked `pos` squares)
//   51 .. 55  in the colour home lane (only that colour can enter it, never capturable)
//   56        home (finished)
// Absolute track square = (START_OFFSET[colour] + pos) % 52, for pos 0..50.
//
// Rules (shown to players before they start):
//  - A 6 is needed to bring a token out of the yard, onto its start square.
//  - A token must finish with the exact number (it cannot go past home).
//  - Landing on a square holding opponent tokens captures them (they go back to their yard), unless the square is safe.
//    Safe squares: the four start squares and the four star squares. Tokens of different colours may share a safe square.
//    There are no blocks: two tokens of one colour on one square can both be captured.
//  - Another roll after: a 6, a capture, or a token reaching home. Three sixes in a row forfeit the turn (the third six does not count).
//  - If no token can move the turn passes (a 6 still rolls again).
//  - The first player to bring all four tokens home wins and the game ends at once. The others are ranked by progress.

export const TRACK = 52;
export const LANE_START = 51; // first home-lane square
export const HOME = 56;
export const YARD = -1;
export const TOKENS = 4;
export const MAX_SIXES = 3; // the third six in a row forfeits the turn
export const START_OFFSET = [0, 13, 26, 39] as const;
export const SAFE_ABS: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const COLOR_NAMES = ["red", "green", "yellow", "blue"] as const;
export type Color = 0 | 1 | 2 | 3;

/** Which colours sit in a game of n players (opposite corners for two, so they face each other). */
export function colorsFor(n: number): Color[] {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  if (n === 4) return [0, 1, 2, 3];
  throw new Error("A game has 2 to 4 players");
}

export interface LudoState {
  colors: Color[]; // colour of each seat, in turn order (clockwise)
  tokens: number[][]; // [seat][token] = position (see above)
  turn: number; // seat whose turn it is
  phase: "roll" | "move" | "over";
  dice: number | null; // last roll while phase === "move"
  sixes: number; // consecutive sixes the current player has rolled
  legal: number[]; // token indexes that may move now (phase "move")
  winner: number | null; // seat
  captures: number[]; // captures made, per seat
  lost: number[]; // tokens lost to captures, per seat
  seq: number; // number of actions taken: the replay guard
}

export type LudoEvent =
  | { type: "roll"; seat: number; value: number }
  | { type: "move"; seat: number; token: number; from: number; to: number; value: number }
  | { type: "release"; seat: number; token: number }
  | { type: "capture"; seat: number; token: number; victimSeat: number; victimToken: number; square: number }
  | { type: "home"; seat: number; token: number }
  | { type: "nomove"; seat: number; value: number }
  | { type: "forfeit"; seat: number }
  | { type: "extra"; seat: number; reason: "six" | "capture" | "home" }
  | { type: "turn"; seat: number }
  | { type: "win"; seat: number };

export function newState(players: number): LudoState {
  const colors = colorsFor(players);
  return {
    colors,
    tokens: colors.map(() => Array<number>(TOKENS).fill(YARD)),
    turn: 0, phase: "roll", dice: null, sixes: 0, legal: [], winner: null,
    captures: colors.map(() => 0), lost: colors.map(() => 0), seq: 0,
  };
}

export const clone = (s: LudoState): LudoState => JSON.parse(JSON.stringify(s)) as LudoState;

/** Absolute track square of a token position, or null when it is in the yard, the lane or home. */
export function absOf(color: number, pos: number): number | null {
  return pos >= 0 && pos < LANE_START ? (START_OFFSET[color] + pos) % TRACK : null;
}
export const isSafeSquare = (abs: number) => SAFE_ABS.has(abs);

/** Where a token ends up after `dice`, or null when it cannot move. */
export function target(pos: number, dice: number): number | null {
  if (pos === HOME) return null;
  if (pos === YARD) return dice === 6 ? 0 : null;
  const to = pos + dice;
  return to > HOME ? null : to;
}

/** Tokens that may move. Tokens standing on the same square are the same move, so only the first is listed. */
export function legalMoves(s: LudoState, seat: number, dice: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (let t = 0; t < TOKENS; t++) {
    const p = s.tokens[seat][t];
    if (target(p, dice) === null || seen.has(p)) continue;
    seen.add(p);
    out.push(t);
  }
  return out;
}

const nextSeat = (s: LudoState, seat: number) => (seat + 1) % s.colors.length;

function passTurn(s: LudoState, ev: LudoEvent[]) {
  s.turn = nextSeat(s, s.turn);
  s.phase = "roll"; s.dice = null; s.sixes = 0; s.legal = [];
  ev.push({ type: "turn", seat: s.turn });
}

/** The current player rolls `value` (1 to 6, supplied by the server's secure dice). */
export function applyRoll(state: LudoState, value: number): { state: LudoState; events: LudoEvent[] } {
  if (state.phase !== "roll") throw new Error("Not the time to roll");
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error("A die shows 1 to 6");
  const s = clone(state);
  const ev: LudoEvent[] = [{ type: "roll", seat: s.turn, value }];
  s.seq++;
  const seat = s.turn;
  if (value === 6 && s.sixes + 1 >= MAX_SIXES) {
    ev.push({ type: "forfeit", seat });
    passTurn(s, ev);
    return { state: s, events: ev };
  }
  const moves = legalMoves(s, seat, value);
  if (moves.length === 0) {
    ev.push({ type: "nomove", seat, value });
    if (value === 6) { s.sixes++; s.dice = null; s.legal = []; ev.push({ type: "extra", seat, reason: "six" }); }
    else passTurn(s, ev);
    return { state: s, events: ev };
  }
  s.dice = value; s.phase = "move"; s.legal = moves;
  return { state: s, events: ev };
}

/** The current player moves one of the legal tokens. */
export function applyMove(state: LudoState, token: number): { state: LudoState; events: LudoEvent[] } {
  if (state.phase !== "move" || state.dice === null) throw new Error("Not the time to move");
  if (!state.legal.includes(token)) throw new Error("That token cannot move");
  const s = clone(state);
  const seat = s.turn;
  const value = s.dice as number;
  const from = s.tokens[seat][token];
  const to = target(from, value) as number;
  const ev: LudoEvent[] = [];
  s.seq++;
  s.tokens[seat][token] = to;
  if (from === YARD) ev.push({ type: "release", seat, token });
  ev.push({ type: "move", seat, token, from, to, value });

  let captured = false;
  const abs = absOf(s.colors[seat], to);
  if (abs !== null && !isSafeSquare(abs)) {
    for (let o = 0; o < s.colors.length; o++) {
      if (o === seat) continue;
      for (let k = 0; k < TOKENS; k++) {
        if (absOf(s.colors[o], s.tokens[o][k]) === abs) {
          s.tokens[o][k] = YARD; s.captures[seat]++; s.lost[o]++; captured = true;
          ev.push({ type: "capture", seat, token, victimSeat: o, victimToken: k, square: abs });
        }
      }
    }
  }
  const reachedHome = to === HOME;
  if (reachedHome) ev.push({ type: "home", seat, token });

  s.dice = null; s.legal = [];
  if (s.tokens[seat].every((p) => p === HOME)) {
    s.phase = "over"; s.winner = seat;
    ev.push({ type: "win", seat });
    return { state: s, events: ev };
  }
  if (value === 6 || captured || reachedHome) {
    s.sixes = value === 6 ? s.sixes + 1 : 0;
    s.phase = "roll";
    ev.push({ type: "extra", seat, reason: value === 6 ? "six" : captured ? "capture" : "home" });
  } else passTurn(s, ev);
  return { state: s, events: ev };
}

/** How far a player has got: tokens home first, then the total squares walked. Used to rank the players who did not win. */
export function progress(s: LudoState, seat: number): { home: number; steps: number } {
  const t = s.tokens[seat];
  return { home: t.filter((p) => p === HOME).length, steps: t.reduce((n, p) => n + (p === YARD ? 0 : p + 1), 0) };
}

/** Seats best first: the winner, then by tokens home, then squares walked, then fewer tokens lost. */
export function ranking(s: LudoState): number[] {
  return s.colors.map((_, i) => i).sort((a, b) => {
    if (a === s.winner) return -1;
    if (b === s.winner) return 1;
    const pa = progress(s, a), pb = progress(s, b);
    return pb.home - pa.home || pb.steps - pa.steps || s.lost[a] - s.lost[b] || a - b;
  });
}

// ----------------------------------------------------------------------------------------------
// The computer players. They get exactly what a person gets (the board and the dice the server rolled)
// and may only choose among the legal moves. They never see a die before it is rolled.

export type Difficulty = "easy" | "normal" | "hard";

/** How many opponent tokens could land on square `abs` with one roll (1 to 6) if it were their turn. */
function threatsTo(s: LudoState, seat: number, abs: number): number {
  let n = 0;
  for (let o = 0; o < s.colors.length; o++) {
    if (o === seat) continue;
    for (const p of s.tokens[o]) {
      const a = absOf(s.colors[o], p);
      if (a === null) continue;
      const d = (abs - a + TRACK) % TRACK;
      if (d >= 1 && d <= 6 && p + d < LANE_START) n++;
    }
  }
  return n;
}

function scoreMove(s: LudoState, token: number, level: Difficulty): number {
  const seat = s.turn, color = s.colors[seat], value = s.dice as number;
  const from = s.tokens[seat][token];
  const to = target(from, value) as number;
  let score = 0;

  // capture: worth more the further the victim had got
  const toAbs = absOf(color, to);
  if (toAbs !== null && !isSafeSquare(toAbs)) {
    for (let o = 0; o < s.colors.length; o++) {
      if (o === seat) continue;
      for (const p of s.tokens[o]) if (absOf(s.colors[o], p) === toAbs) score += 60 + (p / LANE_START) * 60;
    }
  }
  if (to === HOME) score += 70;
  else if (to >= LANE_START && from < LANE_START) score += 38; // into the lane: now untouchable
  if (from === YARD) {
    const out = s.tokens[seat].filter((p) => p !== YARD && p !== HOME).length;
    score += out === 0 ? 55 : 32;
  }
  if (toAbs !== null && isSafeSquare(toAbs) && from !== YARD) score += 20;

  const danger = level === "hard" ? 1 : level === "normal" ? 0.6 : 0;
  const fromAbs = absOf(color, from);
  if (fromAbs !== null && !isSafeSquare(fromAbs)) score += danger * 30 * Math.min(2, threatsTo(s, seat, fromAbs)); // running away
  if (toAbs !== null && !isSafeSquare(toAbs) && to !== HOME) score -= danger * 38 * Math.min(2, threatsTo(s, seat, toAbs)); // walking into trouble
  if (fromAbs !== null && isSafeSquare(fromAbs) && threatsTo(s, seat, fromAbs) === 0) score -= 4 * danger; // no need to leave a safe square

  score += (to / HOME) * 12 + value * 0.5; // progress, favouring the token that is ahead
  if (level === "hard" && from >= 0 && from < LANE_START) score += (from / LANE_START) * 6;
  return score;
}

/** Picks a legal token for the current player. `rng` returns a number in [0, 1). */
export function chooseMove(s: LudoState, level: Difficulty, rng: () => number): number {
  if (s.phase !== "move" || s.legal.length === 0) throw new Error("No move to choose");
  if (s.legal.length === 1) return s.legal[0];
  if (level === "easy" && rng() < 0.45) return s.legal[Math.floor(rng() * s.legal.length)];
  const noise = level === "easy" ? 25 : level === "normal" ? 9 : 0.5;
  let best = s.legal[0], bestScore = -Infinity;
  for (const t of s.legal) {
    const sc = scoreMove(s, t, level) + (rng() - 0.5) * noise;
    if (sc > bestScore) { bestScore = sc; best = t; }
  }
  return best;
}
