import { randomInt } from "crypto";
import { GoalRushGame, GoalRushShot, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import notificationService from "../notification/notification.service";
import loyaltyService from "../loyalty/loyalty.service";
import { AuditService } from "../audit";
import { addDaysKey, startsAtMs, todayKey } from "../../utils/dates";
import { expiryFor, summarize } from "../../utils/loyaltyPoints";
import { Outcome, ShotInput, clampShot, forcedResult, resolveShot } from "./goalrush.sim";

// Unique Goal Rush: a 5-shot penalty game against a goalkeeper the SERVER plays.
//
// Rules (all enforced here, never in the browser):
// - A signed-in customer may START up to 3 games a calendar day (Nepal time). Every game started counts, so a bad start
//   cannot be thrown away and restarted for a better result.
// - A game is exactly 5 shots, taken one at a time in order. The server decides each result (see goalrush.sim.ts).
// - When the 5th shot is in, the game is finished and, in the same transaction, it earns loyalty points if at least 3 of
//   the 5 shots were goals: 1 point for every 3 goals (so 1 point for 3, 4 or 5 goals; 0 for fewer). At most 3 points a day.
//   The reward is written once per game (unique ledger key).
// - Sending the same shot again (refresh, double tap, retry) returns the stored result and changes nothing.
// - A game left alone for 30 minutes (or from an earlier day) is abandoned: it counts for its day and earns nothing.
export const SHOTS_PER_GAME = 5;
export const GAMES_PER_DAY = 3;
export const GOALS_TO_QUALIFY = 3; // a game needs at least this many goals to earn anything
export const GOALS_PER_POINT = 3; // then every 3 goals = 1 loyalty point
export const pointsForGoals = (goals: number) => (goals >= GOALS_TO_QUALIFY ? Math.floor(goals / GOALS_PER_POINT) : 0);
export const POINTS_PER_GAME = pointsForGoals(SHOTS_PER_GAME); // the most one game can earn (1)
export const MAX_POINTS_PER_DAY = GAMES_PER_DAY * POINTS_PER_GAME;
export const STALE_MS = 30 * 60 * 1000;
export const MIN_SHOT_GAP_MS = 600; // no human takes two penalties faster than this
export const KEEPER_LEVEL: 1 | 2 | 3 = 2;

const rng = () => randomInt(0, 1_000_000_000) / 1_000_000_000;

// Tests only: make every shot end the same way, so rewards can be checked exactly.
let forced: Outcome | null = null;
export function __forceOutcome(o: Outcome | null) {
  if (process.env.NODE_ENV !== "test") throw new Error("Only in tests");
  forced = o;
}

type GameWithShots = GoalRushGame & { shots: GoalRushShot[] };

export const rules = () => ({ shotsPerGame: SHOTS_PER_GAME, gamesPerDay: GAMES_PER_DAY, goalsToQualify: GOALS_TO_QUALIFY, goalsPerPoint: GOALS_PER_POINT, pointsPerGame: POINTS_PER_GAME, maxPointsPerDay: MAX_POINTS_PER_DAY });

function shotView(s: GoalRushShot) {
  return { no: s.no, outcome: s.outcome as Outcome, ballX: s.ballX, ballY: s.ballY, keeper: s.keeper, aimX: s.aimX, aimY: s.aimY, power: s.power };
}

export function gameView(g: GameWithShots) {
  return {
    id: g.id, day: g.day, status: g.status, shotsTaken: g.shotsTaken, shotsLeft: Math.max(0, SHOTS_PER_GAME - g.shotsTaken),
    goals: g.goals, saves: g.saves, misses: g.misses, points: g.points, rewardId: g.rewardId,
    startedAt: g.startedAt, finishedAt: g.finishedAt,
    shots: [...g.shots].sort((a, b) => a.no - b.no).map(shotView),
  };
}

const staleWhere = (cutoff: Date, today: string): Prisma.GoalRushGameWhereInput => ({
  status: "active",
  OR: [{ day: { not: today } }, { lastShotAt: null, startedAt: { lt: cutoff } }, { lastShotAt: { lt: cutoff } }],
});

export class GoalRushService {
  /** Games left alone are closed: they count for their day and never earn points. */
  async abandonStale(userId?: string): Promise<number> {
    const r = await prisma.goalRushGame.updateMany({
      where: { ...staleWhere(new Date(Date.now() - STALE_MS), todayKey()), ...(userId ? { userId } : {}) },
      data: { status: "abandoned", finishedAt: new Date() },
    });
    return r.count;
  }

  async allowance(userId: string, today = todayKey()) {
    const [used, pts] = await Promise.all([
      prisma.goalRushGame.count({ where: { userId, day: today } }),
      prisma.goalRushGame.aggregate({ where: { userId, day: today }, _sum: { points: true } }),
    ]);
    return {
      day: today, limit: GAMES_PER_DAY, used, left: Math.max(0, GAMES_PER_DAY - used),
      pointsToday: pts._sum.points ?? 0, maxPointsPerDay: MAX_POINTS_PER_DAY,
      resetsAt: new Date(startsAtMs(addDaysKey(today, 1), 0)),
    };
  }

  /** What the game page needs: today's allowance, a game to resume, the points balance and the last games. */
  async me(userId: string) {
    await this.abandonStale(userId);
    const today = todayKey();
    const [allowance, active, recent, ledger] = await Promise.all([
      this.allowance(userId, today),
      prisma.goalRushGame.findFirst({ where: { userId, status: "active" }, include: { shots: true } }),
      prisma.goalRushGame.findMany({ where: { userId, status: { not: "active" } }, include: { shots: true }, orderBy: { startedAt: "desc" }, take: 10 }),
      loyaltyService.ledger(userId),
    ]);
    return {
      rules: rules(), allowance, active: active ? gameView(active) : null,
      balance: summarize(ledger, today).remaining,
      recent: recent.map(gameView),
    };
  }

  /** Starts a game, or gives back the one still being played. Safe when several requests arrive at once. */
  async start(userId: string) {
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { isActive: true } });
    if (!user || !user.isActive) throw new AppError(403, "Sign in with an active account to play for points.");
    const today = todayKey();
    const cutoff = new Date(Date.now() - STALE_MS);
    const out = await prisma.$transaction(async (tx) => {
      // one start at a time per customer, so the daily count can never be beaten by parallel requests
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${"goalrush:" + userId}))`;
      await tx.goalRushGame.updateMany({ where: { ...staleWhere(cutoff, today), userId }, data: { status: "abandoned", finishedAt: new Date() } });
      const active = await tx.goalRushGame.findFirst({ where: { userId, status: "active" }, include: { shots: true } });
      if (active) return { game: active, resumed: true };
      const used = await tx.goalRushGame.count({ where: { userId, day: today } });
      if (used >= GAMES_PER_DAY) {
        throw new AppError(429, `You have played your ${GAMES_PER_DAY} games for today. Come back tomorrow for more.`);
      }
      const game = await tx.goalRushGame.create({ data: { userId, day: today }, include: { shots: true } });
      return { game, resumed: false };
    });
    if (!out.resumed) await AuditService.log({ action: "GOAL_RUSH_STARTED", entity: "GoalRushGame", entityId: out.game.id, changes: `day ${today}`, userId });
    return { game: gameView(out.game), resumed: out.resumed, allowance: await this.allowance(userId, today) };
  }

  async game(userId: string, id: string) {
    await this.abandonStale(userId);
    const g = await prisma.goalRushGame.findFirst({ where: { id, userId }, include: { shots: true } });
    if (!g) throw new AppError(404, "Game not found");
    return gameView(g);
  }

  async history(userId: string, take = 20) {
    const rows = await prisma.goalRushGame.findMany({ where: { userId, status: { not: "active" } }, include: { shots: true }, orderBy: { startedAt: "desc" }, take: Math.min(Math.max(take, 1), 50) });
    return rows.map(gameView);
  }

  /** One shot. The result, the counters and (after the 5th shot) the reward are written in one transaction. */
  async shoot(userId: string, gameId: string, body: { no?: unknown } & Partial<ShotInput>) {
    const no = Number(body.no);
    if (!Number.isInteger(no) || no < 1 || no > SHOTS_PER_GAME) throw new AppError(400, `Shot number must be 1 to ${SHOTS_PER_GAME}`);
    const input = clampShot({ aimX: Number(body.aimX), aimY: Number(body.aimY), power: Number(body.power) });

    const out = await prisma.$transaction(async (tx) => {
      // lock this game: a double tap or a retried request waits here, then finds the shot already saved
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "GoalRushGame" WHERE id = ${gameId} AND "userId" = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new AppError(404, "Game not found");
      const game = await tx.goalRushGame.findUniqueOrThrow({ where: { id: gameId }, include: { shots: true } });

      const saved = game.shots.find((s) => s.no === no);
      if (saved) return { game, shot: saved, finishedNow: false, expired: false };
      if (game.status !== "active") throw new AppError(409, "This game is over. Start a new one.");

      const now = new Date();
      const last = game.lastShotAt ?? game.startedAt;
      if (game.day !== todayKey(now) || now.getTime() - last.getTime() > STALE_MS) {
        await tx.goalRushGame.update({ where: { id: game.id }, data: { status: "abandoned", finishedAt: now } });
        return { game, shot: null, finishedNow: false, expired: true };
      }
      if (no !== game.shotsTaken + 1) throw new AppError(409, `Take shot ${game.shotsTaken + 1} next.`);
      if (game.lastShotAt && now.getTime() - game.lastShotAt.getTime() < MIN_SHOT_GAP_MS) throw new AppError(429, "One shot at a time. Wait for the ball to land.");

      const r = forced ? forcedResult(input, forced) : resolveShot(input, rng, KEEPER_LEVEL);
      const shot = await tx.goalRushShot.create({
        data: { gameId: game.id, no, aimX: input.aimX, aimY: input.aimY, power: input.power, ballX: r.ballX, ballY: r.ballY, keeper: r.keeper, outcome: r.outcome },
      });

      const goals = game.goals + (r.outcome === "goal" ? 1 : 0);
      const saves = game.saves + (r.outcome === "save" ? 1 : 0);
      const misses = game.misses + (r.outcome === "wide" || r.outcome === "over" || r.outcome === "post" ? 1 : 0);
      const shotsTaken = game.shotsTaken + 1;
      const finished = shotsTaken >= SHOTS_PER_GAME;

      let points = 0;
      let rewardId: string | null = null;
      const earned = finished ? pointsForGoals(goals) : 0;
      if (earned > 0) {
        // never more than the daily maximum, even if something else went wrong
        const today = await tx.goalRushGame.aggregate({ where: { userId, day: game.day }, _sum: { points: true } });
        const room = Math.max(0, MAX_POINTS_PER_DAY - (today._sum.points ?? 0));
        const give = Math.min(earned, room);
        if (give > 0) {
          const entry = await tx.loyaltyEntry.create({
            data: {
              userId, kind: "goal_rush", points: new Prisma.Decimal(give.toFixed(1)), earnedOn: game.day,
              expiresOn: expiryFor("goal_rush", game.day) ?? null, sourceType: "goal_rush", sourceId: game.id,
              detail: `Unique Goal Rush: ${goals} goal${goals === 1 ? "" : "s"} in ${SHOTS_PER_GAME} shots`,
            },
          });
          points = give;
          rewardId = entry.id;
        }
      }
      const updated = await tx.goalRushGame.update({
        where: { id: game.id },
        data: { shotsTaken, goals, saves, misses, lastShotAt: now, ...(finished ? { status: "completed", finishedAt: now, points, rewardId } : {}) },
        include: { shots: true },
      });
      return { game: updated, shot, finishedNow: finished, expired: false };
    });

    if (out.expired) throw new AppError(409, "This game timed out and was closed. Start a new one.");
    const g = out.game;
    if (out.finishedNow) {
      await AuditService.log({ action: "GOAL_RUSH_FINISHED", entity: "GoalRushGame", entityId: g.id, changes: `${g.goals}/${SHOTS_PER_GAME} goals, ${g.saves} saves, ${g.points} points${g.rewardId ? `, reward ${g.rewardId}` : ""}`, userId });
      if (g.points > 0) {
        await notificationService.notify({
          userId, type: "points", title: "Points earned",
          message: `+${g.points} loyalty point${g.points === 1 ? "" : "s"}: Unique Goal Rush (${g.goals} goals)`,
          href: "/points", dedupeKey: `points-goal_rush-goal_rush-${g.id}`,
        });
      }
    }
    return { shot: shotView(out.shot!), game: gameView(g), allowance: await this.allowance(userId, g.day) };
  }
}

export default new GoalRushService();
