import {
  HOME, LANE_START, SAFE_ABS, YARD, absOf, applyMove, applyRoll, chooseMove, colorsFor, legalMoves, newState, ranking, target, LudoState, Difficulty,
} from "../src/modules/ludo/ludo.engine";

// The Ludo rules engine on its own: no database, no server.

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
};
const withTokens = (n: number, tokens: number[][], turn = 0): LudoState => ({ ...newState(n), tokens, turn });
const rollThenMove = (s: LudoState, value: number, token: number) => {
  const r = applyRoll(s, value);
  expect(r.state.phase).toBe("move");
  return applyMove(r.state, token);
};

describe("Ludo engine: dice and leaving the yard", () => {
  it("needs a 6 to leave the yard; any other roll with every token home-bound passes the turn", () => {
    const s = newState(2);
    const r = applyRoll(s, 3);
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe("roll");
    expect(r.events.some((e) => e.type === "nomove")).toBe(true);
  });

  it("a 6 releases a token onto its own start square and rolls again", () => {
    const m = rollThenMove(newState(2), 6, 0);
    expect(m.state.tokens[0][0]).toBe(0);
    expect(m.state.turn).toBe(0);
    expect(m.state.phase).toBe("roll");
    expect(m.events.some((e) => e.type === "release")).toBe(true);
  });

  it("lists equivalent tokens (same square) once, and different squares separately", () => {
    const s = withTokens(2, [[0, 0, 10, YARD], [YARD, YARD, YARD, YARD]]);
    expect(legalMoves(s, 0, 2)).toEqual([0, 2]);
    expect(legalMoves(s, 0, 6)).toEqual([0, 2, 3]);
  });

  it("rejects an impossible die and acting out of phase", () => {
    expect(() => applyRoll(newState(2), 7)).toThrow();
    expect(() => applyRoll(newState(2), 0)).toThrow();
    expect(() => applyMove(newState(2), 0)).toThrow();
    const rolled = applyRoll(withTokens(2, [[5, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), 2).state;
    expect(() => applyRoll(rolled, 3)).toThrow(); // no second roll in a turn
    expect(() => applyMove(rolled, 1)).toThrow(); // that token cannot move
  });
});

describe("Ludo engine: moving, home lane and the exact finish", () => {
  it("cannot go past home: an overshoot is not a legal move", () => {
    expect(target(54, 3)).toBeNull();
    expect(target(54, 2)).toBe(HOME);
    const s = withTokens(2, [[54, HOME, HOME, HOME], [YARD, YARD, YARD, YARD]]);
    const r = applyRoll(s, 3);
    expect(r.events.some((e) => e.type === "nomove")).toBe(true);
    expect(r.state.turn).toBe(1);
  });

  it("enters the home lane after 50 squares and the lane is never on the shared track", () => {
    expect(absOf(0, 50)).toBe(50);
    expect(absOf(0, LANE_START)).toBeNull();
    expect(absOf(1, 0)).toBe(13);
    expect(absOf(1, 39)).toBe(0); // green walks round and passes red's start square
    const m = rollThenMove(withTokens(2, [[48, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), 4, 0);
    expect(m.state.tokens[0][0]).toBe(52);
  });

  it("reaching home gives another roll", () => {
    const m = rollThenMove(withTokens(2, [[54, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), 2, 0);
    expect(m.state.tokens[0][0]).toBe(HOME);
    expect(m.state.turn).toBe(0);
    expect(m.events.some((e) => e.type === "extra" && e.reason === "home")).toBe(true);
  });

  it("a plain move passes the turn", () => {
    const m = rollThenMove(withTokens(2, [[5, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), 3, 0);
    expect(m.state.tokens[0][0]).toBe(8);
    expect(m.state.turn).toBe(1);
  });
});

describe("Ludo engine: capturing and safe squares", () => {
  it("landing on an opponent token on a normal square captures it and gives an extra turn", () => {
    // red token at 3 moves 4 -> square 7. yellow (offset 26) token pos 33 is absolute 59%52 = 7
    const s = withTokens(2, [[3, YARD, YARD, YARD], [33, YARD, YARD, YARD]]);
    expect(absOf(2, 33)).toBe(7);
    const m = rollThenMove(s, 4, 0);
    expect(m.state.tokens[1][0]).toBe(YARD);
    expect(m.state.captures[0]).toBe(1);
    expect(m.state.lost[1]).toBe(1);
    expect(m.state.turn).toBe(0);
    expect(m.events.some((e) => e.type === "capture")).toBe(true);
  });

  it("does not capture on a safe square, and both tokens may stay there", () => {
    // square 8 is a star square. red 4 + 4 = 8; yellow pos 34 is absolute 60%52 = 8
    expect(SAFE_ABS.has(8)).toBe(true);
    const s = withTokens(2, [[4, YARD, YARD, YARD], [34, YARD, YARD, YARD]]);
    const m = rollThenMove(s, 4, 0);
    expect(m.state.tokens[1][0]).toBe(34);
    expect(m.state.captures[0]).toBe(0);
    expect(m.state.turn).toBe(1);
  });

  it("an opponent's start square is safe, and tokens in the home lane cannot be captured", () => {
    // red walks to green's start square (absolute 13): safe, so a green token released there is not touched
    const s = withTokens(3, [[9, YARD, YARD, YARD], [0, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    const m = rollThenMove(s, 4, 0);
    expect(m.state.tokens[1][0]).toBe(0);
    expect(m.state.captures[0]).toBe(0);
  });

  it("captures every opponent token on the square (there are no blocks)", () => {
    const s = withTokens(2, [[3, YARD, YARD, YARD], [33, 33, YARD, YARD]]);
    const m = rollThenMove(s, 4, 0);
    expect(m.state.captures[0]).toBe(2);
    expect(m.state.tokens[1]).toEqual([YARD, YARD, YARD, YARD]);
  });

  it("never captures its own tokens", () => {
    const s = withTokens(2, [[3, 7, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    const m = rollThenMove(s, 4, 0);
    expect(m.state.tokens[0]).toEqual([7, 7, YARD, YARD]);
    expect(m.state.captures[0]).toBe(0);
  });
});

describe("Ludo engine: sixes", () => {
  it("a 6 rolls again; the third 6 in a row forfeits the turn with no move", () => {
    let s = withTokens(2, [[5, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    s = rollThenMove(s, 6, 0).state; // 6 -> 11, extra
    expect(s.sixes).toBe(1);
    s = rollThenMove(s, 6, 0).state; // 6 -> 17, extra
    expect(s.sixes).toBe(2);
    const r = applyRoll(s, 6);
    expect(r.events.some((e) => e.type === "forfeit")).toBe(true);
    expect(r.state.tokens[0][0]).toBe(17); // the third six did not move anything
    expect(r.state.turn).toBe(1);
    expect(r.state.sixes).toBe(0);
  });

  it("a non-six roll resets the count", () => {
    let s = withTokens(2, [[5, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    s = rollThenMove(s, 6, 0).state;
    s = rollThenMove(s, 2, 0).state; // normal move: turn passes
    expect(s.turn).toBe(1);
    expect(s.sixes).toBe(0);
  });

  it("a 6 with no legal move still rolls again", () => {
    const s = withTokens(2, [[54, HOME, HOME, HOME], [YARD, YARD, YARD, YARD]]);
    const r = applyRoll(s, 6);
    expect(r.state.turn).toBe(0);
    expect(r.state.phase).toBe("roll");
  });
});

describe("Ludo engine: winning", () => {
  it("the game ends immediately when the fourth token gets home and nothing can happen afterwards", () => {
    const s = withTokens(3, [[HOME, HOME, HOME, 55], [10, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    const m = rollThenMove(s, 1, 3);
    expect(m.state.phase).toBe("over");
    expect(m.state.winner).toBe(0);
    expect(m.events.some((e) => e.type === "win")).toBe(true);
    expect(() => applyRoll(m.state, 3)).toThrow();
    expect(() => applyMove(m.state, 0)).toThrow();
  });

  it("ranks the others by tokens home, then progress", () => {
    const s = withTokens(3, [[HOME, HOME, HOME, HOME], [HOME, 5, YARD, YARD], [30, 30, 30, 30]]);
    s.winner = 0; s.phase = "over";
    expect(ranking(s)).toEqual([0, 1, 2]);
  });

  it("uses opposite corners for two players and the colour order for three and four", () => {
    expect(colorsFor(2)).toEqual([0, 2]);
    expect(colorsFor(3)).toEqual([0, 1, 2]);
    expect(colorsFor(4)).toEqual([0, 1, 2, 3]);
    expect(() => colorsFor(5)).toThrow();
  });
});

describe("Ludo engine: the computer players", () => {
  function play(n: number, levels: Difficulty[], rng: () => number) {
    let s = newState(n);
    let steps = 0;
    while (s.phase !== "over" && steps++ < 20000) {
      if (s.phase === "roll") s = applyRoll(s, 1 + Math.floor(rng() * 6)).state;
      else {
        const t = chooseMove(s, levels[s.turn], rng);
        expect(s.legal).toContain(t); // a computer only ever picks a legal move
        s = applyMove(s, t).state;
      }
      for (const row of s.tokens) for (const p of row) { expect(p).toBeGreaterThanOrEqual(YARD); expect(p).toBeLessThanOrEqual(HOME); }
    }
    return s;
  }

  it("finishes full games with 2, 3 and 4 players, always with a winner who has all four tokens home", () => {
    for (const n of [2, 3, 4]) {
      for (let g = 0; g < 25; g++) {
        const s = play(n, Array(n).fill("normal"), seeded(100 * n + g));
        expect(s.phase).toBe("over");
        expect(s.tokens[s.winner as number].every((p) => p === HOME)).toBe(true);
      }
    }
  });

  it("plays smarter on hard than on easy (over many games with fair dice)", () => {
    let hard = 0;
    const N = 300;
    for (let g = 0; g < N; g++) {
      const rng = seeded(5000 + g);
      const swap = g % 2 === 1; // alternate who sits first, so the first-move edge is shared
      const s = play(2, swap ? ["easy", "hard"] : ["hard", "easy"], rng);
      if (s.winner === (swap ? 1 : 0)) hard++;
    }
    expect(hard / N).toBeGreaterThan(0.55);
  });

  it("takes a capture when one is on offer, and gets out of the yard on a 6", () => {
    const cap = { ...withTokens(2, [[3, 20, YARD, YARD], [33, YARD, YARD, YARD]]), phase: "move" as const, dice: 4, legal: [0, 1] };
    expect(chooseMove(cap, "hard", seeded(1))).toBe(0);
    const out = { ...withTokens(2, [[YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), phase: "move" as const, dice: 6, legal: [0] };
    expect(chooseMove(out, "normal", seeded(1))).toBe(0);
  });
});
