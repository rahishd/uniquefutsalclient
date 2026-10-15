import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { __forceOutcome } from "../src/modules/goalrush/goalrush.service";
import { resolveShot, saveChance } from "../src/modules/goalrush/goalrush.sim";
import { addDaysKey, todayKey } from "../src/utils/dates";

const P = "9800000871"; // plays everything
const Q = "9800000872"; // tries to touch P's game
const R = "9800000873"; // parallel requests
const ALL = [P, Q, R];

const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shot = (no: number) => ({ no, aimX: 0.6, aimY: 0.7, power: 0.6 });

async function wipe() {
  await prisma.goalRushGame.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

// plays a whole game, waiting between shots like a person would
async function play(p: string, outcomes: ("goal" | "save" | "wide")[]) {
  const g = (await post(p, "/api/goal-rush/games")).body.data.game;
  let last;
  for (let i = 0; i < 5; i++) {
    __forceOutcome(outcomes[i]);
    last = await post(p, `/api/goal-rush/games/${g.id}/shots`, shot(i + 1));
    expect(last.status).toBe(200);
    await sleep(650);
  }
  __forceOutcome(null);
  return { id: g.id as string, last: last!.body.data };
}

const pointsOf = async (p: string) => Number((await prisma.loyaltyEntry.aggregate({ where: { userId: p, kind: "goal_rush" }, _sum: { points: true } }))._sum.points ?? 0);

beforeAll(async () => {
  await wipe();
  for (const p of ALL) await makeUser(p, `Player ${p.slice(-2)}`);
});
afterAll(async () => {
  __forceOutcome(null);
  await wipe();
});

describe("Goal Rush: the kick and the goalkeeper (server side)", () => {
  const seeded = (seed: number) => {
    let s = seed;
    return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  };
  const rate = (aim: { aimX: number; aimY: number; power: number }, n = 4000) => {
    const rng = seeded(7);
    let goals = 0;
    for (let i = 0; i < n; i++) if (resolveShot(aim, rng).outcome === "goal") goals++;
    return goals / n;
  };

  it("is fair: a good corner shot scores often, a weak shot down the middle rarely, and a wild shot misses", () => {
    const corner = rate({ aimX: 0.72, aimY: 0.72, power: 0.55 });
    expect(corner).toBeGreaterThan(0.4);
    expect(corner).toBeLessThan(0.85);
    expect(rate({ aimX: 0, aimY: 0.25, power: 0.05 })).toBeLessThan(0.45);
    expect(rate({ aimX: 1.3, aimY: 0.5, power: 0.9 })).toBeLessThan(0.15);
  });

  it("never lets the keeper save a shot far from where he dived", () => {
    expect(saveChance({ x: 0.8, y: 0.8 }, 0.5, "BL")).toBe(0);
    expect(saveChance({ x: 0.8, y: 0.8 }, 0.5, "TR")).toBeGreaterThan(0.3);
  });
});

describe("Goal Rush: playing for points", () => {
  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/goal-rush/me")).status).toBe(401);
    expect((await api().post("/api/goal-rush/games")).status).toBe(401);
    expect((await api().get("/api/goal-rush/rules")).body.data).toMatchObject({ shotsPerGame: 5, gamesPerDay: 3, goalsToQualify: 3, goalsPerPoint: 3, pointsPerGame: 1, maxPointsPerDay: 3 });
  });

  it("starts a game, and the same request again resumes it instead of starting another", async () => {
    const a = await post(P, "/api/goal-rush/games");
    expect(a.status).toBe(201);
    expect(a.body.data.game).toMatchObject({ status: "active", shotsTaken: 0, shotsLeft: 5 });
    expect(a.body.data.allowance).toMatchObject({ used: 1, left: 2, limit: 3 });
    const b = await post(P, "/api/goal-rush/games");
    expect(b.status).toBe(200);
    expect(b.body.data.resumed).toBe(true);
    expect(b.body.data.game.id).toBe(a.body.data.game.id);
  });

  it("takes shots only in order, from the owner, and a repeated shot returns the stored result", async () => {
    const g = (await get(P, "/api/goal-rush/me")).body.data.active;
    expect((await post(P, `/api/goal-rush/games/${g.id}/shots`, shot(2))).status).toBe(409); // shot 1 first
    expect((await post(Q, `/api/goal-rush/games/${g.id}/shots`, shot(1))).status).toBe(404); // not their game
    expect((await post(P, `/api/goal-rush/games/${g.id}/shots`, { no: 1, aimX: "left", aimY: 0.5, power: 0.5 })).status).toBe(400);

    __forceOutcome("goal");
    const first = await post(P, `/api/goal-rush/games/${g.id}/shots`, shot(1));
    expect(first.status).toBe(200);
    expect(first.body.data.shot.outcome).toBe("goal");
    __forceOutcome("save");
    const again = await post(P, `/api/goal-rush/games/${g.id}/shots`, { ...shot(1), aimX: -0.9 });
    expect(again.body.data.shot).toEqual(first.body.data.shot); // same result, nothing re-rolled
    expect(again.body.data.game.shotsTaken).toBe(1);
    // too fast for a person
    expect((await post(P, `/api/goal-rush/games/${g.id}/shots`, shot(2))).status).toBe(429);
    __forceOutcome(null);
  });

  it("finishes after 5 shots and gives exactly 1 point for 3+ goals, once, however often the last shot is sent", async () => {
    const g = (await get(P, "/api/goal-rush/me")).body.data.active;
    let last;
    const rest = ["goal", "goal", "save", "save"] as const; // 1 goal already + 2 = 3 goals
    for (let no = 2; no <= 5; no++) {
      await sleep(650);
      __forceOutcome(rest[no - 2]);
      last = await post(P, `/api/goal-rush/games/${g.id}/shots`, shot(no));
      expect(last.status).toBe(200);
    }
    __forceOutcome(null);
    expect(last!.body.data.game).toMatchObject({ status: "completed", goals: 3, saves: 2, shotsTaken: 5, points: 1 });
    expect(last!.body.data.game.rewardId).toBeTruthy();
    expect(await pointsOf(P)).toBe(1);

    // replays of the final shot (refresh, double tap) change nothing
    const replays = await Promise.all([1, 2, 3].map(() => post(P, `/api/goal-rush/games/${g.id}/shots`, shot(5))));
    replays.forEach((r) => expect(r.status).toBe(200));
    expect(await pointsOf(P)).toBe(1);
    // and a 6th shot is refused
    expect((await post(P, `/api/goal-rush/games/${g.id}/shots`, { ...shot(5), no: 6 })).status).toBe(400);
    expect(await prisma.notification.count({ where: { userId: P, title: "Points earned" } })).toBe(1);
  });

  it("gives 0 points below 3 goals (here 2), but the game still counts for the day", async () => {
    const r = await play(P, ["goal", "save", "goal", "save", "wide"]);
    expect(r.last.game).toMatchObject({ status: "completed", goals: 2, points: 0, rewardId: null });
    expect(r.last.allowance).toMatchObject({ used: 2, left: 1 });
    expect(await pointsOf(P)).toBe(1);
  });

  it("gives 1 point for a perfect 5/5 too, and stops at 3 games a day: at most 3 points", async () => {
    const r = await play(P, ["goal", "goal", "goal", "goal", "goal"]);
    expect(r.last.game.points).toBe(1);
    expect(await pointsOf(P)).toBe(2); // 1 + 0 + 1
    const fourth = await post(P, "/api/goal-rush/games");
    expect(fourth.status).toBe(429);
    const me = (await get(P, "/api/goal-rush/me")).body.data;
    expect(me.allowance).toMatchObject({ used: 3, left: 0, pointsToday: 2, maxPointsPerDay: 3 });
    expect(me.balance).toBeGreaterThanOrEqual(2);
  });

  it("counts an abandoned game for its day and never pays it", async () => {
    const g = (await post(Q, "/api/goal-rush/games")).body.data.game;
    __forceOutcome("goal");
    await post(Q, `/api/goal-rush/games/${g.id}/shots`, shot(1));
    __forceOutcome(null);
    // left alone for over 30 minutes
    await prisma.goalRushGame.update({ where: { id: g.id }, data: { lastShotAt: new Date(Date.now() - 31 * 60 * 1000) } });
    await sleep(650);
    expect((await post(Q, `/api/goal-rush/games/${g.id}/shots`, shot(2))).status).toBe(409);
    const row = await prisma.goalRushGame.findUniqueOrThrow({ where: { id: g.id } });
    expect(row.status).toBe("abandoned");
    expect(row.points).toBe(0);
    expect(await pointsOf(Q)).toBe(0);
    const me = (await get(Q, "/api/goal-rush/me")).body.data;
    expect(me.allowance).toMatchObject({ used: 1, left: 2 });
    expect(me.active).toBeNull();
  });

  it("resets the next day: games of an earlier day do not count", async () => {
    await prisma.goalRushGame.updateMany({ where: { userId: Q }, data: { day: addDaysKey(todayKey(), -1) } });
    expect((await get(Q, "/api/goal-rush/me")).body.data.allowance).toMatchObject({ used: 0, left: 3 });
  });

  it("cannot be beaten by many start requests at once", async () => {
    const all = await Promise.all(Array.from({ length: 8 }, () => post(R, "/api/goal-rush/games")));
    const ids = new Set(all.filter((r) => r.status < 300).map((r) => r.body.data.game.id));
    expect(ids.size).toBe(1); // one game, the others resumed it
    expect(await prisma.goalRushGame.count({ where: { userId: R } })).toBe(1);
  });
});
