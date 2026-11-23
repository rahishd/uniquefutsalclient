import { randomInt } from "crypto";
import { LudoGame, LudoInvite, LudoPlayer, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import logger from "../../config/logger";
import { AppError } from "../../middlewares/error.middleware";
import notificationService from "../notification/notification.service";
import loyaltyService from "../loyalty/loyalty.service";
import friendsService from "../chat/friends.service";
import { AuditService } from "../audit";
import { addDaysKey, startsAtMs, todayKey } from "../../utils/dates";
import { expiryFor, summarize } from "../../utils/loyaltyPoints";
import { COLOR_NAMES, Difficulty, LudoEvent, LudoState, applyMove, applyRoll, chooseMove, colorsFor, newState, progress, ranking } from "./ludo.engine";
import { isOnline, sendTo, setPresenceHooks } from "./ludo.realtime";

// Unique Ludo: rooms, games, points, daily limits, computer players and reconnection. The SERVER decides everything:
// who may join, the dice, which moves are legal, captures, the winner, the entry fee, the reward and the daily limit.
// The browser only sends actions ("roll", "move token 2") with the game's action counter, and draws what it is given.
//
// Points (all rows of LoyaltyEntry, kind "ludo", written in the same transaction as the game change):
//   entry fee   -1  when a game STARTS (never for opening a lobby), unique per game and player
//   reward      +2  to the human winner, once per game (unique per game and player)
//   refund      +1  only when the server cancels a started game (never for a player who simply left)
// Daily limit (Nepal day): 4 solo and 5 multiplayer games STARTED per customer. Cancelled lobbies never count.
export const ENTRY_FEE = 1;
export const WIN_REWARD = 2;
export const SOLO_LIMIT = 4;
export const MULTI_LIMIT = 5;
export const MAX_INVITES_OPEN = 8;
export const INVITES_PER_HOUR = 20;

export const cfg = {
  botDelayMs: 1000, // pause before a computer player acts, so people can follow
  turnMs: 45_000, // multiplayer: a person has this long for each roll or move
  soloIdleMs: 30 * 60_000, // solo: a game left alone this long is abandoned
  graceMs: 60_000, // a disconnected player keeps their seat this long, then the computer takes over
  lobbyIdleMs: 30 * 60_000,
  strikes: 3, // timed-out turns in a row before the computer takes the seat
};

export const rules = () => ({
  entryFee: ENTRY_FEE, winReward: WIN_REWARD, soloLimit: SOLO_LIMIT, multiLimit: MULTI_LIMIT, minPlayers: 2, maxPlayers: 4,
  turnSeconds: cfg.turnMs / 1000, graceSeconds: cfg.graceMs / 1000, strikes: cfg.strikes, maxSixes: 3,
});

// Tests only: fix the next dice so a whole game can be scripted.
let forcedDice: number[] | null = null;
export function __forceDice(v: number[] | null) {
  if (process.env.NODE_ENV !== "test") throw new Error("Only in tests");
  forcedDice = v ? [...v] : null;
}
const rollDie = () => (forcedDice && forcedDice.length ? (forcedDice.shift() as number) : randomInt(1, 7));
const rngF = () => randomInt(0, 1_000_000_000) / 1_000_000_000;

type Tx = Prisma.TransactionClient;
type Note = { type: string; seat?: number; text?: string };
interface Stored { s: LudoState; last: (LudoEvent | Note)[]; ev: number }
type GameFull = LudoGame & { players: LudoPlayer[]; invites: LudoInvite[] };

const BOT_NAMES = ["Aarav", "Bina", "Chirag", "Dolma", "Esha", "Farhan", "Gita", "Hari"];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const digits = (s: unknown) => (typeof s === "string" ? s.replace(/\D/g, "") : "");
const pairKey = (a: string, b: string) => [a, b].sort().join("|");
const num = (d: Prisma.Decimal | number) => Number(d);
const lockLoyalty = async (tx: Tx, userId: string) => void (await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"loyalty:" + userId}))`);
const stored = (g: LudoGame): Stored | null => (g.state ? (g.state as unknown as Stored) : null);
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

interface Ctx { tx: Tx; game: GameFull; post: (() => Promise<unknown> | unknown)[] }

export class LudoService {
  // ------------------------------------------------------------------ plumbing

  private async lock(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "LudoGame" WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) throw new AppError(404, "Game not found");
  }

  private async load(tx: Tx | typeof prisma, id: string): Promise<GameFull> {
    const g = await tx.ludoGame.findUnique({ where: { id }, include: { players: { orderBy: { seat: "asc" } }, invites: { orderBy: { createdAt: "asc" } } } });
    if (!g) throw new AppError(404, "Game not found");
    return g;
  }

  /** Runs `fn` with the game row locked, then tells every player's open screen what changed. */
  private async run<T>(id: string, fn: (c: Ctx) => Promise<T>, extraTell: string[] = []): Promise<T> {
    const post: Ctx["post"] = [];
    const out = await prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      return fn({ tx, game: await this.load(tx, id), post });
    }, { timeout: 20_000, maxWait: 10_000 });
    for (const p of post) {
      try { await p(); } catch (e) { logger.warn(`ludo follow-up failed: ${(e as Error).message}`); }
    }
    void this.publish(id, extraTell);
    return out;
  }

  /** Pushes the fresh game to everyone in it (and invited people). The browser may also fetch it by itself. */
  async publish(id: string, extra: string[] = []) {
    try {
      const g = await this.load(prisma, id);
      const ids = new Set<string>([...g.players.filter((p) => p.userId).map((p) => p.userId as string), ...g.invites.filter((i) => i.status === "invited").map((i) => i.inviteeId), ...extra]);
      for (const u of ids) if (isOnline(u)) sendTo(u, { type: "game", game: await this.view(g, u) });
    } catch (e) {
      logger.warn(`ludo publish failed: ${(e as Error).message}`);
    }
  }

  private async customer(userId: string) {
    const u = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true, isActive: true, role: true } });
    if (!u || !u.isActive || u.role !== "user") throw new AppError(403, "Sign in with a customer account to play Unique Ludo.");
    return { name: u.name?.trim() || `Player ${userId.slice(-4)}` };
  }

  private async busy(db: Tx | typeof prisma, userId: string, exceptId?: string) {
    return db.ludoPlayer.findFirst({
      where: { userId, status: "joined", game: { status: { in: ["lobby", "active"] }, ...(exceptId ? { id: { not: exceptId } } : {}) } },
      include: { game: { select: { id: true, code: true, status: true, mode: true } } },
    });
  }

  private async assertFree(db: Tx | typeof prisma, userId: string, exceptId?: string) {
    const b = await this.busy(db, userId, exceptId);
    if (b) throw new AppError(409, b.game.status === "active" ? "You already have a game in progress. Finish or leave it first." : "You are already in another room. Leave it first.");
  }

  async usage(userId: string, day = todayKey(), db: Tx | typeof prisma = prisma) {
    const rows = await db.ludoDailyUsage.findMany({ where: { userId, day } });
    const used = (m: string) => rows.find((r) => r.mode === m)?.count ?? 0;
    const mk = (m: "solo" | "multi", limit: number) => ({ used: used(m), limit, left: Math.max(0, limit - used(m)) });
    return { day, solo: mk("solo", SOLO_LIMIT), multi: mk("multi", MULTI_LIMIT), resetsAt: new Date(startsAtMs(addDaysKey(day, 1), 0)) };
  }

  private async balance(userId: string, db: Tx | typeof prisma = prisma) {
    return summarize(await loyaltyService.ledger(userId, db), todayKey()).remaining;
  }

  /** Can this person afford and be allowed one more game of this mode today? Throws a clear message when not. */
  private async assertCanPlay(db: Tx | typeof prisma, userId: string, mode: "solo" | "multi", who?: string) {
    const label = who ?? "You";
    const have = await this.balance(userId, db);
    if (have < ENTRY_FEE) throw new AppError(409, who ? `${who} does not have enough Loyalty Points to play.` : `You need ${ENTRY_FEE} Loyalty Point to play Unique Ludo. You have ${have}.`);
    const u = await this.usage(userId, todayKey(), db);
    const m = mode === "solo" ? u.solo : u.multi;
    if (m.left <= 0) {
      throw new AppError(429, `${label === "You" ? "You have" : label + " has"} played ${m.limit} ${mode === "solo" ? "single player" : "multiplayer"} games today. ${label === "You" ? "You" : "They"} can play again after midnight (Nepal time).`);
    }
  }

  private async genCode(tx: Tx) {
    for (let i = 0; i < 20; i++) {
      let c = "";
      for (let k = 0; k < 6; k++) c += CODE_CHARS[randomInt(0, CODE_CHARS.length)];
      if (!(await tx.ludoGame.findUnique({ where: { code: c }, select: { id: true } }))) return c;
    }
    throw new AppError(500, "Could not make a room code. Try again.");
  }

  // ------------------------------------------------------------------ views

  async view(g: GameFull, viewerId: string) {
    const st = stored(g);
    const ids = [...new Set([...g.players.map((p) => p.userId), ...g.invites.map((i) => i.inviteeId), g.hostId].filter(Boolean) as string[])];
    const users = await prisma.user.findMany({ where: { phoneNumber: { in: ids } }, select: { phoneNumber: true, name: true, avatar: true } });
    const um = new Map(users.map((u) => [u.phoneNumber, u]));
    const nameOf = (id: string) => um.get(id)?.name?.trim() || `Player ${id.slice(-4)}`;
    const me = g.players.find((p) => p.userId === viewerId && p.status !== "removed");
    const seated = g.players.filter((p) => p.status === "joined" || g.status !== "lobby");
    const lobbyN = Math.min(4, Math.max(2, seated.length));
    const colors = st ? st.s.colors : colorsFor(lobbyN);
    const players = seated.map((p) => {
      const sIdx = st ? p.seat : p.seat;
      const prog = st ? progress(st.s, sIdx) : { home: 0, steps: 0 };
      return {
        id: p.id, seat: p.seat, color: COLOR_NAMES[colors[sIdx] ?? sIdx], name: p.name, avatar: p.userId ? um.get(p.userId)?.avatar ?? null : null,
        isBot: p.isBot, botControl: p.botControl, isMe: p.userId === viewerId, isHost: p.userId === g.hostId,
        online: p.isBot ? true : p.userId ? isOnline(p.userId) : false, ready: p.ready || p.userId === g.hostId, status: p.status,
        result: p.result, rank: p.rank, captures: st ? st.s.captures[sIdx] ?? 0 : 0, lost: st ? st.s.lost[sIdx] ?? 0 : 0, home: prog.home,
        disconnectedSince: p.disconnectedAt,
      };
    });
    const invites = g.invites.filter((i) => i.status === "invited" || i.status === "declined").map((i) => ({
      id: i.id, name: nameOf(i.inviteeId), avatar: um.get(i.inviteeId)?.avatar ?? null, status: i.status, online: isOnline(i.inviteeId), isMe: i.inviteeId === viewerId,
    }));
    const myInvite = g.invites.find((i) => i.inviteeId === viewerId && i.status === "invited");
    const humanTurn = st && g.status === "active" ? g.players.find((p) => p.seat === st.s.turn) : undefined;
    const youWon = !!me && g.status === "completed" && g.winnerSeat === me.seat;
    const board = st ? { ...st.s, legal: me && st.s.turn === me.seat ? st.s.legal : [] } : null;
    return {
      id: g.id, code: g.code, mode: g.mode, status: g.status, difficulty: g.difficulty, maxPlayers: g.maxPlayers,
      hostName: nameOf(g.hostId), isHost: g.hostId === viewerId, mySeat: me?.seat ?? null, myPlayerId: me?.id ?? null,
      players, invites, myInviteId: myInvite?.id ?? null, board, last: st?.last ?? [],
      turnEndsAt: g.mode === "multi" && g.status === "active" && humanTurn && !humanTurn.isBot && !humanTurn.botControl ? g.actAt : null,
      you: { fee: ENTRY_FEE, reward: WIN_REWARD },
      createdAt: g.createdAt, startedAt: g.startedAt, finishedAt: g.finishedAt, cancelReason: g.cancelReason, serverNow: new Date(),
      outcome: g.status === "completed" || g.status === "abandoned"
        ? { winnerSeat: g.winnerSeat, ranking: st ? ranking(st.s) : [], youWon, pointsEarned: me?.rewardEntryId ? WIN_REWARD : 0, pointsSpent: me?.feeEntryId ? ENTRY_FEE : 0, refunded: !!me?.refundEntryId }
        : null,
    };
  }

  // ------------------------------------------------------------------ overview, friends, history

  async me(userId: string) {
    await this.customer(userId);
    const [balance, limits, mine, invites, fr, recent, stats] = await Promise.all([
      this.balance(userId), this.usage(userId), this.busy(prisma, userId),
      prisma.ludoInvite.findMany({ where: { inviteeId: userId, status: "invited", game: { status: "lobby" } }, include: { game: { include: { players: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
      friendsService.overview(userId), this.history(userId, 5), this.stats(userId),
    ]);
    return {
      rules: rules(), balance, limits,
      current: mine ? { id: mine.game.id, code: mine.game.code, status: mine.game.status, mode: mine.game.mode } : null,
      invites: invites.map((i) => ({ id: i.id, gameId: i.gameId, code: i.game.code, from: i.game.players.find((p) => p.userId === i.inviterId)?.name ?? "A friend", at: i.createdAt })),
      friends: { total: fr.friends.length, online: fr.friends.filter((f) => isOnline(f.phone)).length },
      recent, stats,
    };
  }

  /** My friends (the existing friend list) with who is online and, for a room, who is invited or seated. */
  async friends(userId: string, gameId?: string, q?: string) {
    const fr = await friendsService.overview(userId);
    let invites: LudoInvite[] = [], seated = new Set<string>();
    if (gameId) {
      const g = await this.load(prisma, gameId);
      if (!g.players.some((p) => p.userId === userId)) throw new AppError(404, "Room not found");
      invites = g.invites; seated = new Set(g.players.filter((p) => p.status === "joined" && p.userId).map((p) => p.userId as string));
    }
    const needle = (q ?? "").trim().toLowerCase();
    return fr.friends
      .filter((f) => !needle || f.name.toLowerCase().includes(needle) || f.phone.includes(needle))
      .map((f) => {
        const inv = invites.find((i) => i.inviteeId === f.phone);
        const state = seated.has(f.phone) ? "joined" : inv ? inv.status : "none";
        return { phone: f.phone, name: f.name, avatar: f.avatar, online: isOnline(f.phone), invite: state };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }

  async history(userId: string, take = 20, skip = 0) {
    const rows = await prisma.ludoPlayer.findMany({
      where: { userId, game: { status: { in: ["completed", "abandoned", "cancelled"] } } },
      include: { game: { include: { players: true } } }, orderBy: { game: { createdAt: "desc" } }, take: Math.min(Math.max(take, 1), 50), skip: Math.max(Math.floor(skip) || 0, 0),
    });
    return rows.map((r) => {
      const g = r.game;
      const dur = g.startedAt && g.finishedAt ? Math.round((g.finishedAt.getTime() - g.startedAt.getTime()) / 1000) : 0;
      return {
        id: g.id, code: g.code, mode: g.mode, status: g.status, at: g.finishedAt ?? g.createdAt, durationSec: dur,
        opponents: g.players.filter((p) => p.seat !== r.seat && p.status !== "removed").map((p) => (p.isBot ? `${p.name} (computer)` : p.name)),
        result: g.status === "cancelled" ? "cancelled" : g.status === "abandoned" && r.result !== "left" ? "abandoned" : r.result ?? "lost",
        pointsSpent: r.feeEntryId ? ENTRY_FEE : 0, pointsEarned: r.rewardEntryId ? WIN_REWARD : 0, refunded: !!r.refundEntryId, players: g.players.length,
      };
    });
  }

  async stats(userId: string) {
    const rows = await prisma.ludoPlayer.findMany({
      where: { userId, feeEntryId: { not: null }, game: { status: { in: ["completed", "abandoned"] } } },
      select: { result: true, captures: true, game: { select: { mode: true, finishedAt: true } } }, orderBy: { game: { finishedAt: "asc" } }, take: 2000,
    });
    let wins = 0, losses = 0, captures = 0, vsFriends = 0, streak = 0, best = 0;
    for (const r of rows) {
      captures += r.captures;
      if (r.game.mode === "multi") vsFriends++;
      if (r.result === "won") { wins++; streak++; best = Math.max(best, streak); } else { streak = 0; if (r.result === "lost") losses++; }
    }
    const played = rows.length;
    return { played, wins, losses, winRate: played ? Math.round((wins / played) * 100) : 0, captures, vsFriends, bestStreak: best };
  }

  async leaderboard(opts: { period?: string; sort?: string; mode?: string }) {
    const month = opts.period === "month";
    const mode = opts.mode === "solo" || opts.mode === "all" ? opts.mode : "multi";
    const since = month ? new Date(startsAtMs(todayKey().slice(0, 7) + "-01", 0)) : new Date(0);
    const rows = await prisma.$queryRaw<{ userId: string; name: string | null; played: bigint; wins: bigint }[]>`
      SELECT p."userId" AS "userId", u."name" AS name, COUNT(*) AS played, COUNT(*) FILTER (WHERE p."result" = 'won') AS wins
      FROM "LudoPlayer" p JOIN "LudoGame" g ON g."id" = p."gameId" JOIN "User" u ON u."phoneNumber" = p."userId"
      WHERE g."status" IN ('completed','abandoned') AND p."feeEntryId" IS NOT NULL AND g."finishedAt" >= ${since}
        AND (${mode}::text = 'all' OR g."mode" = ${mode}::text)
      GROUP BY p."userId", u."name" LIMIT 500`;
    const list = rows.map((r) => ({ userId: r.userId, name: firstName(r.name?.trim() || `Player ${r.userId.slice(-4)}`), played: Number(r.played), wins: Number(r.wins) }))
      .map((r) => ({ ...r, winRate: r.played ? Math.round((r.wins / r.played) * 100) : 0 }));
    const sort = opts.sort === "rate" ? "rate" : opts.sort === "played" ? "played" : "wins";
    const pool = sort === "rate" ? list.filter((r) => r.played >= 5) : list.filter((r) => r.wins > 0 || sort === "played");
    pool.sort((a, b) => sort === "rate" ? b.winRate - a.winRate || b.played - a.played : sort === "played" ? b.played - a.played || b.wins - a.wins : b.wins - a.wins || a.played - b.played);
    // never show phone numbers: only a first name and the numbers
    return { period: month ? "month" : "all", sort, mode, minGamesForRate: 5, rows: pool.slice(0, 20).map((r, i) => ({ rank: i + 1, name: r.name, wins: r.wins, played: r.played, winRate: r.winRate })) };
  }

  // ------------------------------------------------------------------ starting a game

  private botSetup(n: number) {
    const names = [...BOT_NAMES].sort(() => rngF() - 0.5);
    return Array.from({ length: n }, (_, i) => `${names[i]}`);
  }

  /** Charges every human 1 point, counts the day, and makes the game live. All inside the caller's transaction. */
  private async begin(c: Ctx, humans: LudoPlayer[]) {
    const { tx, game } = c;
    const mode = game.mode as "solo" | "multi";
    const today = todayKey();
    const ids = [...new Set(humans.map((h) => h.userId as string))].sort();
    for (const id of ids) await lockLoyalty(tx, id);
    for (const h of humans) {
      await this.assertCanPlay(tx, h.userId as string, mode, mode === "multi" && h.userId !== game.hostId ? h.name : undefined);
      if (await this.busy(tx, h.userId as string, game.id)) throw new AppError(409, `${h.name} is in another game.`);
    }
    for (const h of humans) {
      const uid = h.userId as string;
      const fee = await tx.loyaltyEntry.create({
        data: { userId: uid, kind: "ludo", points: new Prisma.Decimal((-ENTRY_FEE).toFixed(1)), earnedOn: today, expiresOn: null, sourceType: "ludo_fee", sourceId: `${game.id}:${uid}`, detail: `Unique Ludo entry (${game.code})` },
      });
      await tx.ludoPlayer.update({ where: { id: h.id }, data: { feeEntryId: fee.id } });
      await tx.ludoDailyUsage.upsert({ where: { userId_day_mode: { userId: uid, day: today, mode } }, create: { userId: uid, day: today, mode, count: 1 }, update: { count: { increment: 1 } } });
    }
  }

  private nextAct(mode: string, st: LudoState, players: LudoPlayer[], now = Date.now()): Date | null {
    if (st.phase === "over") return null;
    const p = players.find((x) => x.seat === st.turn);
    if (p && (p.isBot || p.botControl)) return new Date(now + cfg.botDelayMs);
    return new Date(now + (mode === "solo" ? cfg.soloIdleMs : cfg.turnMs));
  }

  async startSolo(userId: string, input: { opponents?: unknown; difficulty?: unknown }) {
    const { name } = await this.customer(userId);
    const opp = Number(input.opponents);
    if (!Number.isInteger(opp) || opp < 1 || opp > 3) throw new AppError(400, "Choose 1, 2 or 3 computer opponents.");
    const difficulty = (["easy", "normal", "hard"] as const).includes(input.difficulty as Difficulty) ? (input.difficulty as Difficulty) : "normal";
    const n = opp + 1;
    let id = "";
    try {
      id = await prisma.$transaction(async (tx) => {
        await lockLoyalty(tx, userId);
        await this.assertFree(tx, userId);
        const code = await this.genCode(tx);
        const g = await tx.ludoGame.create({ data: { code, mode: "solo", status: "lobby", hostId: userId, maxPlayers: n, difficulty } });
        const bots = this.botSetup(opp);
        await tx.ludoPlayer.create({ data: { gameId: g.id, seat: 0, userId, name, ready: true } });
        for (let i = 0; i < opp; i++) await tx.ludoPlayer.create({ data: { gameId: g.id, seat: i + 1, name: `${bots[i]} (CPU)`, isBot: true, ready: true } });
        const full = await this.load(tx, g.id);
        const c: Ctx = { tx, game: full, post: [] };
        await this.begin(c, full.players.filter((p) => p.userId));
        await this.goLive(c, n, 0);
        return g.id;
      }, { timeout: 20_000 });
    } catch (e) {
      if (e instanceof AppError) throw e;
      logger.error(`Ludo solo start failed (nothing was charged): ${(e as Error).message}`);
      throw new AppError(500, "Could not start the game. You were not charged. Please try again.");
    }
    await AuditService.log({ action: "LUDO_STARTED", entity: "LudoGame", entityId: id, changes: `solo vs ${opp} computer, ${difficulty}`, userId });
    return this.getView(userId, id);
  }

  /** Makes a game live: builds the board, picks who starts, schedules the next action. */
  private async goLive(c: Ctx, n: number, hostSeat: number) {
    const { tx, game } = c;
    const st = newState(n);
    if (game.mode === "multi") st.turn = randomInt(0, n);
    else st.turn = hostSeat;
    const players = await tx.ludoPlayer.findMany({ where: { gameId: game.id }, orderBy: { seat: "asc" } });
    const s: Stored = { s: st, last: [{ type: "start", seat: st.turn }], ev: 0 };
    await tx.ludoGame.update({
      where: { id: game.id },
      data: { status: "active", state: s as unknown as Prisma.InputJsonValue, day: todayKey(), startedAt: new Date(), turnSeat: st.turn, actAt: this.nextAct(game.mode, st, players), lastActivityAt: new Date() },
    });
  }

  // ------------------------------------------------------------------ rooms (multiplayer lobby)

  async createRoom(userId: string, input: { maxPlayers?: unknown }) {
    const { name } = await this.customer(userId);
    const max = input.maxPlayers === undefined ? 4 : Number(input.maxPlayers);
    if (!Number.isInteger(max) || max < 2 || max > 4) throw new AppError(400, "A room has 2 to 4 players.");
    const id = await prisma.$transaction(async (tx) => {
      await lockLoyalty(tx, userId);
      await this.assertFree(tx, userId);
      await this.assertCanPlay(tx, userId, "multi");
      const code = await this.genCode(tx);
      const g = await tx.ludoGame.create({ data: { code, mode: "multi", status: "lobby", hostId: userId, maxPlayers: max } });
      await tx.ludoPlayer.create({ data: { gameId: g.id, seat: 0, userId, name, ready: true } });
      return g.id;
    });
    return this.getView(userId, id);
  }

  /** The room or game a person may look at: they sit in it, or hold an invitation to it. Anyone else gets "not found". */
  async getView(userId: string, idOrCode: string) {
    const g = await prisma.ludoGame.findFirst({ where: { OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }] }, include: { players: { orderBy: { seat: "asc" } }, invites: true } });
    const allowed = g && (g.players.some((p) => p.userId === userId) || g.invites.some((i) => i.inviteeId === userId && i.status !== "cancelled"));
    if (!g || !allowed) throw new AppError(404, "Room not found, or you are not invited to it.");
    return this.view(g, userId);
  }

  async invite(userId: string, gameId: string, phoneInput: unknown) {
    const phone = digits(phoneInput);
    if (!phone || phone === userId) throw new AppError(400, "Pick a friend to invite.");
    const friendship = await prisma.friendship.findUnique({ where: { pairKey: pairKey(userId, phone) } });
    if (!friendship || friendship.status !== "accepted") throw new AppError(403, "You can only invite people from your friend list.");
    const hostName = (await this.customer(userId)).name;
    const since = new Date(Date.now() - 3600_000);
    if ((await prisma.ludoInvite.count({ where: { inviterId: userId, createdAt: { gte: since } } })) >= INVITES_PER_HOUR) throw new AppError(429, "You sent a lot of invitations. Try again in a while.");
    return this.run(gameId, async (c) => {
      const g = c.game;
      if (g.hostId !== userId || g.mode !== "multi") throw new AppError(403, "Only the host can invite players.");
      if (g.status !== "lobby") throw new AppError(409, "The game has already started.");
      if (g.players.some((p) => p.userId === phone && p.status === "joined")) throw new AppError(409, "They are already in the room.");
      if (g.invites.filter((i) => i.status === "invited").length >= MAX_INVITES_OPEN) throw new AppError(409, "Too many invitations are waiting. Wait for answers or cancel some.");
      const existing = g.invites.find((i) => i.inviteeId === phone);
      let inv: LudoInvite;
      if (existing) {
        if (existing.status === "invited") throw new AppError(409, "You already invited them.");
        inv = await c.tx.ludoInvite.update({ where: { id: existing.id }, data: { status: "invited", respondedAt: null, createdAt: new Date() } });
      } else inv = await c.tx.ludoInvite.create({ data: { gameId: g.id, inviterId: userId, inviteeId: phone } });
      await c.tx.ludoGame.update({ where: { id: g.id }, data: { lastActivityAt: new Date() } });
      c.post.push(() => notificationService.notify({
        userId: phone, type: "players", title: "Unique Ludo invitation", message: `${firstName(hostName)} invited you to play Unique Ludo. Tap to join the room.`,
        href: `/ludo/room/${g.code}`, dedupeKey: `ludo-invite-${inv.id}-${inv.createdAt.getTime()}`,
      }));
      return { invited: true };
    }, [phone]);
  }

  async cancelInvite(userId: string, gameId: string, inviteId: string) {
    return this.run(gameId, async (c) => {
      if (c.game.hostId !== userId) throw new AppError(403, "Only the host can do this.");
      if (c.game.status !== "lobby") throw new AppError(409, "The game has already started.");
      const inv = c.game.invites.find((i) => i.id === inviteId);
      if (!inv) throw new AppError(404, "Invitation not found");
      await c.tx.ludoInvite.update({ where: { id: inv.id }, data: { status: "cancelled", respondedAt: new Date() } });
      return { cancelled: true };
    });
  }

  private seatFor(g: GameFull) {
    const taken = new Set(g.players.filter((p) => p.status === "joined").map((p) => p.seat));
    for (let s = 0; s < g.maxPlayers; s++) if (!taken.has(s)) return s;
    return -1;
  }

  async acceptInvite(userId: string, inviteId: string) {
    const inv = await prisma.ludoInvite.findUnique({ where: { id: inviteId } });
    if (!inv || inv.inviteeId !== userId) throw new AppError(404, "Invitation not found");
    const { name } = await this.customer(userId);
    return this.run(inv.gameId, async (c) => {
      const fresh = c.game.invites.find((i) => i.id === inviteId);
      if (!fresh || fresh.status !== "invited") throw new AppError(409, "This invitation is no longer open.");
      if (c.game.status !== "lobby") throw new AppError(409, c.game.status === "active" ? "The game has already started." : "This room was closed.");
      const seat = this.seatFor(c.game);
      if (seat < 0) throw new AppError(409, "The room is full.");
      await lockLoyalty(c.tx, userId);
      await this.assertFree(c.tx, userId, c.game.id);
      await this.assertCanPlay(c.tx, userId, "multi");
      await c.tx.ludoPlayer.deleteMany({ where: { gameId: c.game.id, userId, status: { not: "joined" } } });
      await c.tx.ludoPlayer.create({ data: { gameId: c.game.id, seat, userId, name } });
      await c.tx.ludoInvite.update({ where: { id: inviteId }, data: { status: "accepted", respondedAt: new Date() } });
      await c.tx.ludoGame.update({ where: { id: c.game.id }, data: { lastActivityAt: new Date() } });
      return { gameId: c.game.id, code: c.game.code };
    });
  }

  async declineInvite(userId: string, inviteId: string) {
    const inv = await prisma.ludoInvite.findUnique({ where: { id: inviteId } });
    if (!inv || inv.inviteeId !== userId) throw new AppError(404, "Invitation not found");
    return this.run(inv.gameId, async (c) => {
      const fresh = c.game.invites.find((i) => i.id === inviteId);
      if (!fresh || fresh.status !== "invited") throw new AppError(409, "This invitation is no longer open.");
      await c.tx.ludoInvite.update({ where: { id: inviteId }, data: { status: "declined", respondedAt: new Date() } });
      return { declined: true };
    }, [userId]);
  }

  /** Join with a room code. A code alone never opens a private room: there has to be an open invitation for this person. */
  async joinByCode(userId: string, codeInput: unknown) {
    const code = typeof codeInput === "string" ? codeInput.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new AppError(400, "Enter the 6 character room code.");
    const g = await prisma.ludoGame.findUnique({ where: { code }, include: { invites: true, players: true } });
    if (g && g.status !== "lobby" && g.status !== "active") throw new AppError(409, "This room is closed.");
    if (g?.players.some((p) => p.userId === userId && p.status === "joined")) return { gameId: g.id, code: g.code };
    const inv = g?.invites.find((i) => i.inviteeId === userId && i.status === "invited");
    if (!g || !inv) throw new AppError(403, "You need an invitation from the host to join this room.");
    return this.acceptInvite(userId, inv.id);
  }

  async setReady(userId: string, gameId: string, ready: boolean) {
    return this.run(gameId, async (c) => {
      const me = c.game.players.find((p) => p.userId === userId && p.status === "joined");
      if (!me || c.game.status !== "lobby") throw new AppError(409, "You are not in this room.");
      await c.tx.ludoPlayer.update({ where: { id: me.id }, data: { ready: !!ready } });
      await c.tx.ludoGame.update({ where: { id: c.game.id }, data: { lastActivityAt: new Date() } });
      return { ready: !!ready };
    });
  }

  async kick(userId: string, gameId: string, playerId: string) {
    return this.run(gameId, async (c) => {
      if (c.game.hostId !== userId) throw new AppError(403, "Only the host can remove players.");
      if (c.game.status !== "lobby") throw new AppError(409, "The game has already started.");
      const p = c.game.players.find((x) => x.id === playerId && x.status === "joined");
      if (!p || p.userId === userId) throw new AppError(404, "Player not found");
      await c.tx.ludoPlayer.delete({ where: { id: p.id } });
      await c.tx.ludoInvite.updateMany({ where: { gameId, inviteeId: p.userId as string }, data: { status: "cancelled", respondedAt: new Date() } });
      c.post.push(() => notificationService.notify({ userId: p.userId as string, type: "players", title: "Unique Ludo", message: "The host removed you from the room.", href: "/ludo", dedupeKey: `ludo-kick-${p.id}` }));
      return { removed: true };
    }, []);
  }

  async leave(userId: string, gameId: string) {
    return this.run(gameId, async (c) => {
      const g = c.game;
      const me = g.players.find((p) => p.userId === userId && p.status === "joined");
      if (!me) throw new AppError(404, "You are not in this game.");
      if (g.status === "lobby") {
        if (g.hostId === userId) return this.cancelLobby(c, "The host closed the room.");
        await c.tx.ludoPlayer.delete({ where: { id: me.id } });
        await c.tx.ludoInvite.updateMany({ where: { gameId: g.id, inviteeId: userId }, data: { status: "declined", respondedAt: new Date() } });
        return { left: true };
      }
      if (g.status !== "active") throw new AppError(409, "This game is over.");
      return this.forfeit(c, me);
    });
  }

  async cancel(userId: string, gameId: string) {
    return this.run(gameId, async (c) => {
      if (c.game.hostId !== userId) throw new AppError(403, "Only the host can cancel the room.");
      if (c.game.status !== "lobby") throw new AppError(409, "A game that has started cannot be cancelled. You can leave it.");
      return this.cancelLobby(c, "The host closed the room.");
    });
  }

  private async cancelLobby(c: Ctx, reason: string) {
    await c.tx.ludoGame.update({ where: { id: c.game.id }, data: { status: "cancelled", cancelReason: reason, finishedAt: new Date(), actAt: null } });
    await c.tx.ludoInvite.updateMany({ where: { gameId: c.game.id, status: "invited" }, data: { status: "cancelled", respondedAt: new Date() } });
    return { cancelled: true, left: true };
  }

  async start(userId: string, gameId: string) {
    try {
      const out = await this.run(gameId, async (c) => {
        const g = c.game;
        if (g.hostId !== userId || g.mode !== "multi") throw new AppError(403, "Only the host can start the game.");
        if (g.status !== "lobby") throw new AppError(409, g.status === "active" ? "The game has already started." : "This room is closed.");
        const seated = g.players.filter((p) => p.status === "joined");
        if (seated.length < 2) throw new AppError(409, "You need at least 2 players to start.");
        const waiting = seated.filter((p) => p.userId !== g.hostId && !p.ready);
        if (waiting.length) throw new AppError(409, `Waiting for ${waiting.map((p) => firstName(p.name)).join(", ")} to be ready.`);
        // seats become 0..n-1 in order (someone may have been removed), then everyone pays and the game goes live
        const ordered = [...seated].sort((a, b) => a.seat - b.seat);
        for (let i = 0; i < ordered.length; i++) if (ordered[i].seat !== i) await c.tx.ludoPlayer.update({ where: { id: ordered[i].id }, data: { seat: i } });
        await c.tx.ludoInvite.updateMany({ where: { gameId: g.id, status: "invited" }, data: { status: "cancelled", respondedAt: new Date() } });
        await this.begin(c, ordered);
        await this.goLive(c, ordered.length, 0);
        c.post.push(() => AuditService.log({ action: "LUDO_STARTED", entity: "LudoGame", entityId: g.id, changes: `multiplayer, ${ordered.length} players`, userId }));
        return { started: true };
      });
      return out;
    } catch (e) {
      if (e instanceof AppError) throw e;
      logger.error(`Ludo start failed (nothing was charged): ${(e as Error).message}`);
      throw new AppError(500, "Could not start the game. Nobody was charged. Please try again.");
    }
  }

  // ------------------------------------------------------------------ playing

  private async writeEvents(tx: Tx, gameId: string, stor: Stored, evs: LudoEvent[], extra?: { seat: number; kind: string; detail: string }) {
    const rows: Prisma.LudoEventCreateManyInput[] = [];
    for (const e of evs) {
      if (e.type === "roll") rows.push({ gameId, seq: ++stor.ev, seat: e.seat, kind: "roll", value: e.value });
      else if (e.type === "move") rows.push({ gameId, seq: ++stor.ev, seat: e.seat, kind: "move", token: e.token, value: e.value, detail: `${e.from}>${e.to}` });
      else if (e.type === "capture") rows.push({ gameId, seq: ++stor.ev, seat: e.seat, kind: "capture", token: e.victimToken, detail: `seat ${e.victimSeat}` });
    }
    if (extra) rows.push({ gameId, seq: ++stor.ev, seat: extra.seat, kind: extra.kind, detail: extra.detail });
    if (rows.length) await tx.ludoEvent.createMany({ data: rows });
  }

  /** Saves a new board, schedules what happens next, and ends the game when someone has won. */
  private async commit(c: Ctx, stor: Stored, evs: LudoEvent[], notes: Note[] = [], extra?: { seat: number; kind: string; detail: string }) {
    const { tx, game } = c;
    stor.last = [...evs, ...notes];
    await this.writeEvents(tx, game.id, stor, evs, extra);
    const players = await tx.ludoPlayer.findMany({ where: { gameId: game.id }, orderBy: { seat: "asc" } });
    const now = new Date();
    if (stor.s.phase === "over") {
      await tx.ludoGame.update({ where: { id: game.id }, data: { state: stor as unknown as Prisma.InputJsonValue, turnSeat: null, actAt: null, lastActivityAt: now } });
      await this.finish(c, stor, "completed");
      return;
    }
    await tx.ludoGame.update({
      where: { id: game.id },
      data: { state: stor as unknown as Prisma.InputJsonValue, turnSeat: stor.s.turn, actAt: this.nextAct(game.mode, stor.s, players), lastActivityAt: now },
    });
  }

  /** Ends a game: result and rank for everyone, and the 2 point reward for a human winner (once). */
  private async finish(c: Ctx, stor: Stored, kind: "completed" | "abandoned") {
    const { tx, game } = c;
    const players = await tx.ludoPlayer.findMany({ where: { gameId: game.id }, orderBy: { seat: "asc" } });
    const order = ranking(stor.s);
    const winnerSeat = kind === "completed" ? stor.s.winner : null;
    const today = todayKey();
    for (const p of players) {
      let result: string | null = p.result;
      if (!result) result = kind === "completed" ? (p.seat === winnerSeat ? "won" : "lost") : "left";
      let rewardEntryId = p.rewardEntryId;
      // a computer playing in someone's place never earns for them
      if (kind === "completed" && p.seat === winnerSeat && p.userId && !p.botControl && p.status === "joined" && p.feeEntryId && !rewardEntryId) {
        await lockLoyalty(tx, p.userId);
        const sid = `${game.id}:${p.userId}`;
        const have = await tx.loyaltyEntry.findFirst({ where: { kind: "ludo", sourceType: "ludo_win", sourceId: sid } });
        const entry = have ?? (await tx.loyaltyEntry.create({
          data: { userId: p.userId, kind: "ludo", points: new Prisma.Decimal(WIN_REWARD.toFixed(1)), earnedOn: today, expiresOn: expiryFor("ludo", today) ?? null, sourceType: "ludo_win", sourceId: sid, detail: `Unique Ludo win (${game.code})` },
        }));
        rewardEntryId = entry.id;
        const uid = p.userId;
        c.post.push(async () => {
          await notificationService.notify({
            userId: uid, type: "points", title: "Points earned", message: `+${WIN_REWARD} loyalty points: you won Unique Ludo`,
            href: await loyaltyService.pointsHref(uid, "ludo_win", sid), dedupeKey: `points-ludo-${sid}`,
          });
        });
      }
      await tx.ludoPlayer.update({ where: { id: p.id }, data: { result, rank: order.indexOf(p.seat) + 1, captures: stor.s.captures[p.seat] ?? 0, rewardEntryId } });
    }
    await tx.ludoGame.update({ where: { id: game.id }, data: { status: kind, winnerSeat, finishedAt: new Date(), actAt: null, turnSeat: null, cancelReason: kind === "abandoned" ? game.cancelReason ?? "Abandoned" : null } });
    c.post.push(() => AuditService.log({ action: "LUDO_FINISHED", entity: "LudoGame", entityId: game.id, changes: `${kind}${winnerSeat !== null ? `, winner seat ${winnerSeat}` : ""}` }));
  }

  private bumpHuman(c: Ctx, p: LudoPlayer) {
    return c.tx.ludoPlayer.update({ where: { id: p.id }, data: { missedTurns: 0, disconnectedAt: null, botControl: p.status === "joined" ? false : p.botControl } });
  }

  private actionFor(g: GameFull, userId: string, seq: unknown) {
    if (g.status !== "active") throw new AppError(409, g.status === "lobby" ? "The game has not started yet." : "This game is over.");
    const me = g.players.find((p) => p.userId === userId && p.status === "joined");
    if (!me) throw new AppError(403, "You are not playing in this game.");
    const stor = stored(g) as Stored;
    if (stor.s.turn !== me.seat) throw new AppError(409, "It is not your turn.");
    if (!Number.isInteger(seq) || seq !== stor.s.seq) throw new AppError(409, "The game moved on. Refreshing.");
    return { me, stor };
  }

  async roll(userId: string, gameId: string, seq: unknown) {
    await this.run(gameId, async (c) => {
      const { me, stor } = this.actionFor(c.game, userId, seq);
      if (stor.s.phase !== "roll") throw new AppError(409, "Choose a token to move.");
      const r = applyRoll(stor.s, rollDie());
      stor.s = r.state;
      await this.bumpHuman(c, me);
      await this.commit(c, stor, r.events);
    });
    return this.getView(userId, gameId);
  }

  async move(userId: string, gameId: string, token: unknown, seq: unknown) {
    await this.run(gameId, async (c) => {
      const { me, stor } = this.actionFor(c.game, userId, seq);
      if (stor.s.phase !== "move") throw new AppError(409, "Roll the dice first.");
      if (!Number.isInteger(token) || !stor.s.legal.includes(token as number)) throw new AppError(409, "That token cannot move.");
      const r = applyMove(stor.s, token as number);
      stor.s = r.state;
      await this.bumpHuman(c, me);
      await this.commit(c, stor, r.events);
    });
    return this.getView(userId, gameId);
  }

  // ------------------------------------------------------------------ leaving, computer players, timers

  private async forfeit(c: Ctx, me: LudoPlayer) {
    const { tx, game } = c;
    const stor = stored(game) as Stored;
    if (game.mode === "solo") {
      await tx.ludoPlayer.update({ where: { id: me.id }, data: { result: "left", status: "joined" } });
      await this.finish(c, stor, "abandoned");
      return { left: true };
    }
    await tx.ludoPlayer.update({ where: { id: me.id }, data: { result: "left", status: "left", botControl: true } });
    await tx.ludoEvent.create({ data: { gameId: game.id, seq: ++stor.ev, seat: me.seat, kind: "takeover", detail: "left the game" } });
    stor.last = [{ type: "takeover", seat: me.seat, text: `${firstName(me.name)} left. The computer plays their seat.` }];
    const players = await tx.ludoPlayer.findMany({ where: { gameId: game.id } });
    if (!players.some((p) => p.userId && p.status === "joined" && !p.botControl)) {
      await tx.ludoGame.update({ where: { id: game.id }, data: { state: stor as unknown as Prisma.InputJsonValue, cancelReason: "Everyone left" } });
      await this.finish({ ...c, game: { ...game, cancelReason: "Everyone left" } }, stor, "abandoned");
    } else {
      await tx.ludoGame.update({ where: { id: game.id }, data: { state: stor as unknown as Prisma.InputJsonValue, actAt: this.nextAct(game.mode, stor.s, players), lastActivityAt: new Date() } });
    }
    return { left: true };
  }

  /** One due action for a game: a computer player rolls or moves, or a timed-out turn is played for the person. */
  async runDue(id: string): Promise<boolean> {
    let did = false;
    await this.run(id, async (c) => {
      const g = c.game;
      if (g.status !== "active" || !g.actAt || g.actAt.getTime() > Date.now()) return;
      const stor = stored(g) as Stored;
      const actor = g.players.find((p) => p.seat === stor.s.turn);
      if (!actor) return;
      const computer = actor.isBot || actor.botControl;
      did = true;
      if (!computer && g.mode === "solo") {
        await tx_note(c, "idle");
        await this.finish({ ...c, game: { ...g, cancelReason: "Left alone too long" } }, stor, "abandoned");
        return;
      }
      const level = (actor.isBot && g.mode === "solo" ? g.difficulty : "normal") as Difficulty;
      const notes: Note[] = [];
      let evs: LudoEvent[] = [];
      if (stor.s.phase === "roll") {
        const r = applyRoll(stor.s, rollDie());
        stor.s = r.state; evs = r.events;
      }
      // a computer waits one step between roll and move; a person who ran out of time gets the whole turn played for them
      if (stor.s.phase === "move" && (!computer || evs.length === 0)) {
        const r = applyMove(stor.s, chooseMove(stor.s, level, rngF));
        stor.s = r.state; evs = [...evs, ...r.events];
      }
      if (!computer) {
        const strikes = actor.missedTurns + 1;
        notes.push({ type: "auto", seat: actor.seat, text: `${firstName(actor.name)} ran out of time. The game played for them.` });
        if (strikes >= cfg.strikes) {
          await c.tx.ludoPlayer.update({ where: { id: actor.id }, data: { missedTurns: strikes, botControl: true } });
          notes.push({ type: "takeover", seat: actor.seat, text: `${firstName(actor.name)} missed ${cfg.strikes} turns in a row. The computer plays their seat until they act.` });
        } else await c.tx.ludoPlayer.update({ where: { id: actor.id }, data: { missedTurns: strikes } });
      }
      await this.commit(c, stor, evs, notes);
    });
    return did;
  }

  /** Processes every game whose next action is due. Called about twice a second by the server. */
  async tick(): Promise<number> {
    const due = await prisma.ludoGame.findMany({ where: { status: "active", actAt: { lte: new Date() } }, select: { id: true }, take: 50 });
    let n = 0;
    for (const g of due) {
      try { if (await this.runDue(g.id)) n++; } catch (e) { logger.warn(`ludo tick ${g.id}: ${(e as Error).message}`); }
    }
    return n;
  }

  /** Slower housekeeping: computer takes over from people who stayed away past the grace time; stale lobbies close. */
  async sweep(): Promise<{ takeovers: number; lobbies: number }> {
    const out = { takeovers: 0, lobbies: 0 };
    const cutoff = new Date(Date.now() - cfg.graceMs);
    const gone = await prisma.ludoPlayer.findMany({
      where: { userId: { not: null }, status: "joined", botControl: false, disconnectedAt: { lt: cutoff }, game: { status: "active", mode: "multi" } },
      select: { id: true, gameId: true },
    });
    for (const p of gone) {
      try {
        await this.run(p.gameId, async (c) => {
          const me = c.game.players.find((x) => x.id === p.id);
          if (c.game.status !== "active" || !me || me.botControl || !me.disconnectedAt || me.disconnectedAt > cutoff) return;
          if (me.userId && isOnline(me.userId)) return;
          const stor = stored(c.game) as Stored;
          await c.tx.ludoPlayer.update({ where: { id: me.id }, data: { botControl: true } });
          await c.tx.ludoEvent.create({ data: { gameId: c.game.id, seq: ++stor.ev, seat: me.seat, kind: "takeover", detail: "disconnected" } });
          stor.last = [{ type: "takeover", seat: me.seat, text: `${firstName(me.name)} lost connection. The computer plays their seat until they come back.` }];
          const players = await c.tx.ludoPlayer.findMany({ where: { gameId: c.game.id } });
          if (!players.some((x) => x.userId && x.status === "joined" && !x.botControl)) {
            await c.tx.ludoGame.update({ where: { id: c.game.id }, data: { state: stor as unknown as Prisma.InputJsonValue, cancelReason: "Everyone disconnected" } });
            await this.finish({ ...c, game: { ...c.game, cancelReason: "Everyone disconnected" } }, stor, "abandoned");
          } else {
            await c.tx.ludoGame.update({ where: { id: c.game.id }, data: { state: stor as unknown as Prisma.InputJsonValue, actAt: stor.s.turn === me.seat ? new Date() : c.game.actAt } });
          }
          out.takeovers++;
        });
      } catch (e) { logger.warn(`ludo sweep ${p.gameId}: ${(e as Error).message}`); }
    }
    const stale = await prisma.ludoGame.findMany({ where: { status: "lobby", lastActivityAt: { lt: new Date(Date.now() - cfg.lobbyIdleMs) } }, select: { id: true } });
    for (const g of stale) {
      try { await this.run(g.id, async (c) => { if (c.game.status === "lobby") { await this.cancelLobby(c, "The room timed out."); out.lobbies++; } }); } catch (e) { logger.warn(`ludo lobby ${g.id}: ${(e as Error).message}`); }
    }
    return out;
  }

  /** Only the server cancels a started game (for example after a fault): everyone gets their point back and the day count is released. */
  async cancelWithRefund(gameId: string, reason: string) {
    return this.run(gameId, async (c) => {
      const g = c.game;
      if (g.status !== "active") throw new AppError(409, "Only a game in progress can be cancelled.");
      const today = g.day ?? todayKey();
      for (const p of g.players) {
        if (!p.userId || !p.feeEntryId || p.refundEntryId) continue;
        await lockLoyalty(c.tx, p.userId);
        const sid = `${g.id}:${p.userId}`;
        const e = await c.tx.loyaltyEntry.create({
          data: { userId: p.userId, kind: "ludo", points: new Prisma.Decimal(ENTRY_FEE.toFixed(1)), earnedOn: todayKey(), expiresOn: expiryFor("ludo", todayKey()) ?? null, sourceType: "ludo_refund", sourceId: sid, detail: `Unique Ludo refund (${g.code}): ${reason}` },
        });
        await c.tx.ludoPlayer.update({ where: { id: p.id }, data: { refundEntryId: e.id, result: "cancelled" } });
        await c.tx.ludoDailyUsage.updateMany({ where: { userId: p.userId, day: today, mode: g.mode, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
      }
      await c.tx.ludoGame.update({ where: { id: g.id }, data: { status: "cancelled", cancelReason: reason, finishedAt: new Date(), actAt: null } });
      return { refunded: true };
    });
  }

  // ------------------------------------------------------------------ presence (called by the socket)

  async markOnline(userId: string) {
    const mine = await prisma.ludoPlayer.findMany({ where: { userId, status: "joined", game: { status: { in: ["lobby", "active"] } } }, select: { id: true, gameId: true, botControl: true, disconnectedAt: true, game: { select: { status: true } } } });
    for (const p of mine) {
      if (p.game.status === "active" && (p.disconnectedAt || p.botControl)) {
        // the person is back: they get their seat back (a computer that was playing for them stops)
        await this.run(p.gameId, async (c) => {
          const me = c.game.players.find((x) => x.id === p.id);
          if (!me || c.game.status !== "active") return;
          const stor = stored(c.game) as Stored;
          const wasBot = me.botControl;
          await c.tx.ludoPlayer.update({ where: { id: me.id }, data: { disconnectedAt: null, botControl: false, missedTurns: 0 } });
          if (wasBot) {
            stor.last = [{ type: "back", seat: me.seat, text: `${firstName(me.name)} is back and plays again.` }];
            const players = await c.tx.ludoPlayer.findMany({ where: { gameId: c.game.id } });
            await c.tx.ludoGame.update({ where: { id: c.game.id }, data: { state: stor as unknown as Prisma.InputJsonValue, actAt: this.nextAct(c.game.mode, stor.s, players) } });
          }
        });
      } else void this.publish(p.gameId);
    }
  }

  async markOffline(userId: string) {
    const mine = await prisma.ludoPlayer.findMany({ where: { userId, status: "joined", game: { status: { in: ["lobby", "active"] } } }, select: { id: true, gameId: true, game: { select: { status: true } } } });
    for (const p of mine) {
      if (p.game.status === "active") await prisma.ludoPlayer.update({ where: { id: p.id }, data: { disconnectedAt: new Date() } });
      void this.publish(p.gameId);
    }
  }

  /** After a restart nobody is connected yet: everyone in a live game starts their grace time now. */
  async resetPresence() {
    await prisma.ludoPlayer.updateMany({ where: { userId: { not: null }, status: "joined", disconnectedAt: null, game: { status: "active" } }, data: { disconnectedAt: new Date() } });
  }
}

// a placeholder so a solo game left alone leaves a trace in the audit log
async function tx_note(c: Ctx, why: string) {
  c.post.push(() => AuditService.log({ action: "LUDO_IDLE", entity: "LudoGame", entityId: c.game.id, changes: why }));
}

const service = new LudoService();
export default service;

let timers: NodeJS.Timeout[] = [];
export function startLudoEngine() {
  if (timers.length) return;
  setPresenceHooks(
    (u) => void service.markOnline(u).catch((e) => logger.warn(`ludo online: ${e.message}`)),
    (u) => void service.markOffline(u).catch((e) => logger.warn(`ludo offline: ${e.message}`)),
  );
  void service.resetPresence().catch(() => undefined);
  let busy = false;
  timers.push(setInterval(() => { if (busy) return; busy = true; service.tick().catch((e) => logger.warn(`ludo tick: ${e.message}`)).finally(() => { busy = false; }); }, 500));
  timers.push(setInterval(() => void service.sweep().catch((e) => logger.warn(`ludo sweep: ${e.message}`)), 5000));
  timers.forEach((t) => t.unref());
}
export function stopLudoEngine() {
  timers.forEach(clearInterval);
  timers = [];
}
