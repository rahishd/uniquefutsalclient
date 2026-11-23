import { Prisma } from "@prisma/client";
import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import ludo, { __forceDice, cfg } from "../src/modules/ludo/ludo.service";
import { addMonthsKey, todayKey } from "../src/utils/dates";

// Unique Ludo on the server: points, daily limits, rooms, invitations, turns, reconnection and refunds.

const A = "9800000881"; // host and main player
const B = "9800000882"; // A's friend
const C = "9800000883"; // not a friend
const D = "9800000884"; // another friend
const E = "9800000885"; // another friend
const ALL = [A, B, C, D, E];

const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);
const del = (p: string, url: string) => api().delete(url).set(bearer(tokenFor(p)));

let n = 0;
async function grant(userId: string, points: number) {
  await prisma.loyaltyEntry.create({
    data: { userId, kind: "game", points: new Prisma.Decimal(points.toFixed(1)), earnedOn: todayKey(), expiresOn: addMonthsKey(todayKey(), 3), sourceType: "test", sourceId: `ludo-test-${userId}-${++n}`, detail: "test points" },
  });
}
const balance = async (u: string) => (await get(u, "/api/ludo/me")).body.data.balance as number;
const ludoRows = (u: string, sourceType?: string) => prisma.loyaltyEntry.findMany({ where: { userId: u, kind: "ludo", ...(sourceType ? { sourceType } : {}) } });
const usage = async (u: string, mode: string) => (await prisma.ludoDailyUsage.findUnique({ where: { userId_day_mode: { userId: u, day: todayKey(), mode } } }))?.count ?? 0;

async function wipe() {
  await prisma.ludoGame.deleteMany({ where: { OR: [{ hostId: { in: ALL } }, { players: { some: { userId: { in: ALL } } } }] } });
  await prisma.ludoDailyUsage.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: { in: ALL } }, { addresseeId: { in: ALL } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}
const friends = (a: string, b: string) => prisma.friendship.create({ data: { pairKey: [a, b].sort().join("|"), requesterId: a, addresseeId: b, status: "accepted" } });

// Put a live game on a chosen board (tests only): { seat: tokens } and whose turn it is
async function setBoard(gameId: string, tokens: number[][], turn: number, extra: { actAt?: Date } = {}) {
  const g = await prisma.ludoGame.findUniqueOrThrow({ where: { id: gameId } });
  const st = g.state as unknown as { s: { tokens: number[][]; turn: number; phase: string; dice: number | null; legal: number[] } };
  st.s.tokens = tokens; st.s.turn = turn; st.s.phase = "roll"; st.s.dice = null; st.s.legal = [];
  await prisma.ludoGame.update({ where: { id: gameId }, data: { state: st as unknown as Prisma.InputJsonValue, turnSeat: turn, actAt: extra.actAt ?? new Date(Date.now() + 3600_000) } });
}
const view = async (u: string, id: string) => (await get(u, `/api/ludo/games/${id}`)).body.data;

async function newRoom(host: string, guests: string[], max = 4) {
  const room = (await post(host, "/api/ludo/rooms", { maxPlayers: max })).body.data;
  for (const g of guests) {
    expect((await post(host, `/api/ludo/rooms/${room.id}/invite`, { phone: g })).status).toBe(201);
    const inv = (await get(g, "/api/ludo/me")).body.data.invites.find((i: { gameId: string }) => i.gameId === room.id);
    expect((await post(g, `/api/ludo/invites/${inv.id}/accept`)).status).toBe(200);
    expect((await post(g, `/api/ludo/rooms/${room.id}/ready`, { ready: true })).status).toBe(200);
  }
  return room.id as string;
}

beforeAll(async () => {
  cfg.botDelayMs = 0;
  await wipe();
  for (const p of ALL) await makeUser(p, `Player ${p.slice(-2)}`);
  await friends(A, B); await friends(A, D); await friends(A, E);
});
afterEach(async () => { __forceDice(null); });
afterAll(async () => { __forceDice(null); await wipe(); });

describe("Unique Ludo: entry fee and reward", () => {
  it("refuses to start without a loyalty point, and charges nothing", async () => {
    const r = await post(A, "/api/ludo/solo", { opponents: 1 });
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/1 Loyalty Point/);
    expect(await ludoRows(A)).toHaveLength(0);
    expect(await usage(A, "solo")).toBe(0);
  });

  it("needs a signed-in account", async () => {
    expect((await api().post("/api/ludo/solo").send({ opponents: 1 })).status).toBe(401);
    expect((await api().get("/api/ludo/me")).status).toBe(401);
  });

  it("solo: charges exactly 1 point once, counts one game, and the human winner gets 2 exactly once", async () => {
    await grant(A, 10);
    const before = await balance(A);
    const g = (await post(A, "/api/ludo/solo", { opponents: 2, difficulty: "normal" })).body.data;
    expect(g.status).toBe("active");
    expect(g.players).toHaveLength(3);
    expect(g.players.filter((p: { isBot: boolean }) => p.isBot)).toHaveLength(2);
    expect(await balance(A)).toBe(before - 1);
    expect(await usage(A, "solo")).toBe(1);

    // the human must be the one to act: put the game one move from a win and let the human take it
    await setBoard(g.id, [[56, 56, 56, 55], [10, -1, -1, -1], [-1, -1, -1, -1]], 0);
    __forceDice([1]);
    const seq = (await view(A, g.id)).board.seq;
    // a fake roll with a stale counter is refused, and so is a roll for the wrong game state
    expect((await post(A, `/api/ludo/games/${g.id}/roll`, { seq: seq + 5 })).status).toBe(409);
    const rolled = await post(A, `/api/ludo/games/${g.id}/roll`, { seq });
    expect(rolled.status).toBe(200);
    expect(rolled.body.data.board.legal).toEqual([3]);
    // two identical move requests at once: only one can win and reward
    const s2 = rolled.body.data.board.seq;
    const [m1, m2] = await Promise.all([post(A, `/api/ludo/games/${g.id}/move`, { token: 3, seq: s2 }), post(A, `/api/ludo/games/${g.id}/move`, { token: 3, seq: s2 })]);
    expect([m1.status, m2.status].sort()).toEqual([200, 409]);
    const done = await view(A, g.id);
    expect(done.status).toBe("completed");
    expect(done.outcome.youWon).toBe(true);
    expect(done.outcome.pointsEarned).toBe(2);
    expect(await balance(A)).toBe(before - 1 + 2);
    expect(await ludoRows(A, "ludo_win")).toHaveLength(1);
    expect(await ludoRows(A, "ludo_fee")).toHaveLength(1);
    // nothing more can happen after the game ends
    expect((await post(A, `/api/ludo/games/${g.id}/roll`, { seq: done.board.seq })).status).toBe(409);
    expect((await post(A, `/api/ludo/games/${g.id}/move`, { token: 0, seq: done.board.seq })).status).toBe(409);
    await ludo.tick();
    expect(await ludoRows(A, "ludo_win")).toHaveLength(1);

    const hist = (await get(A, "/api/ludo/history")).body.data[0];
    expect(hist).toMatchObject({ mode: "solo", result: "won", pointsSpent: 1, pointsEarned: 2 });
    expect(hist.opponents).toHaveLength(2);
    // Profile > Unique Ludo Game loads older games with ?skip=: the only game is on the first page, and nothing is older
    expect((await get(A, "/api/ludo/history?limit=20&skip=0")).body.data).toHaveLength(1);
    expect((await get(A, "/api/ludo/history?limit=20&skip=1")).body.data).toEqual([]);
    const stats = (await get(A, "/api/ludo/stats")).body.data;
    expect(stats.wins).toBe(1);
    expect(stats.played).toBe(1);
  });

  it("solo: the computer wins fairly and the human gets nothing but loses the 1 point; computers never earn", async () => {
    await grant(A, 5);
    const before = await balance(A);
    const g = (await post(A, "/api/ludo/solo", { opponents: 1, difficulty: "hard" })).body.data;
    await setBoard(g.id, [[10, -1, -1, -1], [56, 56, 56, 55]], 1, { actAt: new Date() });
    __forceDice([1]);
    await ludo.tick(); // the computer rolls
    await ludo.tick(); // the computer moves its last token home
    const done = await view(A, g.id);
    expect(done.status).toBe("completed");
    expect(done.outcome.youWon).toBe(false);
    expect(done.outcome.pointsEarned).toBe(0);
    expect(await balance(A)).toBe(before - 1);
    expect(await prisma.loyaltyEntry.count({ where: { sourceType: "ludo_win", sourceId: { startsWith: g.id } } })).toBe(0);
  });

  it("a real game against the computer plays through to the end by itself", async () => {
    await grant(A, 5);
    const g = (await post(A, "/api/ludo/solo", { opponents: 3, difficulty: "easy" })).body.data;
    let v = await view(A, g.id);
    for (let i = 0; i < 6000 && v.status === "active"; i++) {
      if (v.board.turn === v.mySeat) {
        const r = v.board.phase === "roll" ? await post(A, `/api/ludo/games/${g.id}/roll`, { seq: v.board.seq }) : await post(A, `/api/ludo/games/${g.id}/move`, { token: v.board.legal[0], seq: v.board.seq });
        expect(r.status).toBe(200);
        v = r.body.data;
      } else {
        await ludo.tick();
        v = await view(A, g.id);
      }
    }
    expect(v.status).toBe("completed");
    expect(v.outcome.ranking).toHaveLength(4);
    expect(await ludoRows(A, "ludo_win")).toHaveLength(v.outcome.youWon ? 2 : 1); // 1 from the earlier test, plus this game only if won
  }, 120000);
});

describe("Unique Ludo: daily limits", () => {
  it("allows 4 single player games a day however they end, then refuses and says when to come back", async () => {
    await prisma.ludoGame.updateMany({ where: { hostId: A, status: "active" }, data: { status: "abandoned" } });
    await prisma.ludoDailyUsage.deleteMany({ where: { userId: A } });
    await grant(A, 20);
    for (let i = 0; i < 4; i++) {
      const g = await post(A, "/api/ludo/solo", { opponents: 1 });
      expect(g.status).toBe(201);
      expect((await post(A, `/api/ludo/games/${g.body.data.id}/leave`)).status).toBe(200); // leaving does not give the game back
    }
    expect(await usage(A, "solo")).toBe(4);
    const fifth = await post(A, "/api/ludo/solo", { opponents: 1 });
    expect(fifth.status).toBe(429);
    expect(fifth.body.message).toMatch(/4 single player games/);
    const me = (await get(A, "/api/ludo/me")).body.data;
    expect(me.limits.solo).toMatchObject({ used: 4, limit: 4, left: 0 });
    expect(new Date(me.limits.resetsAt).getTime()).toBeGreaterThan(Date.now());
    // parallel requests cannot squeeze past the limit either
    await prisma.ludoDailyUsage.update({ where: { userId_day_mode: { userId: A, day: todayKey(), mode: "solo" } }, data: { count: 3 } });
    const rs = await Promise.all([1, 2, 3].map(() => post(A, "/api/ludo/solo", { opponents: 1 })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await usage(A, "solo")).toBe(4);
    await prisma.ludoGame.updateMany({ where: { hostId: A, status: "active" }, data: { status: "abandoned" } });
  });

  it("multiplayer has its own limit of 5, separate from solo, and it is enforced when making a room", async () => {
    await prisma.ludoDailyUsage.upsert({ where: { userId_day_mode: { userId: A, day: todayKey(), mode: "multi" } }, create: { userId: A, day: todayKey(), mode: "multi", count: 5 }, update: { count: 5 } });
    const r = await post(A, "/api/ludo/rooms", {});
    expect(r.status).toBe(429);
    expect(r.body.message).toMatch(/5 multiplayer games/);
    await prisma.ludoDailyUsage.delete({ where: { userId_day_mode: { userId: A, day: todayKey(), mode: "multi" } } });
  });
});

describe("Unique Ludo: rooms, invitations and security", () => {
  it("only friends can be invited; strangers cannot see, join or guess their way into a private room", async () => {
    await grant(A, 10); await grant(B, 10); await grant(C, 10);
    const room = (await post(A, "/api/ludo/rooms", {})).body.data;
    expect(room.status).toBe("lobby");
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect((await post(A, `/api/ludo/rooms/${room.id}/invite`, { phone: C })).status).toBe(403); // not a friend
    expect((await get(C, `/api/ludo/rooms/${room.id}`)).status).toBe(404);
    expect((await get(C, `/api/ludo/rooms/${room.code}`)).status).toBe(404);
    expect((await post(C, "/api/ludo/rooms/join", { code: room.code })).status).toBe(403); // the code alone is not enough
    expect((await post(B, `/api/ludo/rooms/${room.id}/invite`, { phone: A })).status).toBe(403); // not the host
    expect((await post(A, `/api/ludo/rooms/${room.id}/invite`, { phone: B })).status).toBe(201);
    expect((await post(A, `/api/ludo/rooms/${room.id}/invite`, { phone: B })).status).toBe(409); // already invited
    const mine = (await get(B, "/api/ludo/me")).body.data;
    expect(mine.invites[0].code).toBe(room.code);
    expect((await get(B, `/api/ludo/rooms/${room.code}`)).status).toBe(200); // an invited friend may look
    // the host cannot start with one player, and nobody has paid for opening a lobby
    expect((await post(A, `/api/ludo/rooms/${room.id}/start`)).status).toBe(409);
    expect((await ludoRows(A, "ludo_fee")).filter((r) => r.sourceId.startsWith(room.id))).toHaveLength(0);
    expect(await usage(A, "multi")).toBe(0);
    // joining by code works for the invited friend
    expect((await post(B, "/api/ludo/rooms/join", { code: room.code })).status).toBe(200);
    // a lobby that is cancelled costs nothing and does not count
    expect((await post(B, `/api/ludo/rooms/${room.id}/cancel`)).status).toBe(403);
    expect((await post(A, `/api/ludo/rooms/${room.id}/cancel`)).status).toBe(200);
    expect(await usage(A, "multi")).toBe(0);
    expect(await usage(B, "multi")).toBe(0);
    expect((await post(B, "/api/ludo/rooms/join", { code: room.code })).status).toBe(409);
  });

  it("declining, removing and a full room", async () => {
    await grant(D, 5); await grant(E, 5);
    const room = (await post(A, "/api/ludo/rooms", { maxPlayers: 2 })).body.data;
    await post(A, `/api/ludo/rooms/${room.id}/invite`, { phone: D });
    await post(A, `/api/ludo/rooms/${room.id}/invite`, { phone: E });
    const invD = (await get(D, "/api/ludo/me")).body.data.invites[0];
    const invE = (await get(E, "/api/ludo/me")).body.data.invites[0];
    expect((await post(D, `/api/ludo/invites/${invD.id}/decline`)).status).toBe(200);
    expect((await get(A, `/api/ludo/rooms/${room.id}`)).body.data.invites.find((i: { status: string }) => i.status === "declined")).toBeTruthy();
    expect((await post(D, `/api/ludo/invites/${invD.id}/accept`)).status).toBe(409);
    expect((await post(E, `/api/ludo/invites/${invE.id}/accept`)).status).toBe(200);
    // E is in. A third friend cannot get into a room of 2
    await post(A, `/api/ludo/rooms/${room.id}/invite`, { phone: D });
    const invD2 = (await get(D, "/api/ludo/me")).body.data.invites[0];
    const full = await post(D, `/api/ludo/invites/${invD2.id}/accept`);
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/full/);
    // the host removes E, who is told and loses the seat
    const v = (await get(A, `/api/ludo/rooms/${room.id}`)).body.data;
    const eP = v.players.find((p: { isMe: boolean }) => !p.isMe);
    expect((await del(E, `/api/ludo/rooms/${room.id}/players/${eP.id}`)).status).toBe(403);
    expect((await del(A, `/api/ludo/rooms/${room.id}/players/${eP.id}`)).status).toBe(200);
    expect((await get(E, `/api/ludo/rooms/${room.id}`)).status).toBe(404);
    await post(A, `/api/ludo/rooms/${room.id}/cancel`);
  });

  it("a multiplayer game: everyone pays 1 once, each seat must wait its turn, the winner gets 2, the others nothing", async () => {
    await prisma.ludoDailyUsage.deleteMany({ where: { userId: { in: [A, B] } } });
    const roomId = await newRoom(A, [B], 2);
    const [a0, b0] = [await balance(A), await balance(B)];
    // the host cannot start while a guest is not ready
    await post(B, `/api/ludo/rooms/${roomId}/ready`, { ready: false });
    expect((await post(A, `/api/ludo/rooms/${roomId}/start`)).status).toBe(409);
    await post(B, `/api/ludo/rooms/${roomId}/ready`, { ready: true });
    expect((await post(B, `/api/ludo/rooms/${roomId}/start`)).status).toBe(403); // only the host
    const [s1, s2] = await Promise.all([post(A, `/api/ludo/rooms/${roomId}/start`), post(A, `/api/ludo/rooms/${roomId}/start`)]);
    expect([s1.status, s2.status].sort()).toEqual([200, 409]);
    expect(await balance(A)).toBe(a0 - 1);
    expect(await balance(B)).toBe(b0 - 1);
    expect(await usage(A, "multi")).toBe(1);
    expect(await usage(B, "multi")).toBe(1);
    expect((await ludoRows(A, "ludo_fee")).filter((r) => r.sourceId.startsWith(roomId))).toHaveLength(1);

    const v = await view(A, roomId);
    expect(v.status).toBe("active");
    const turnUser = v.board.turn === v.mySeat ? A : B;
    const waiting = turnUser === A ? B : A;
    // the other player cannot roll, and a stale counter is refused
    expect((await post(waiting, `/api/ludo/games/${roomId}/roll`, { seq: v.board.seq })).status).toBe(409);
    expect((await post(turnUser, `/api/ludo/games/${roomId}/roll`, { seq: v.board.seq + 1 })).status).toBe(409);
    expect((await get(C, `/api/ludo/games/${roomId}`)).status).toBe(404); // an outsider sees nothing
    expect((await post(C, `/api/ludo/games/${roomId}/roll`, { seq: 0 })).status).toBe(403);
    // a player who is in another game cannot join or start a second one
    expect((await post(A, "/api/ludo/solo", { opponents: 1 })).status).toBe(409);

    // the player to move is one step from winning
    const seatOf = (u: string) => (u === A ? (v.mySeat as number) : 1 - (v.mySeat as number));
    const toks = [[-1, -1, -1, -1], [-1, -1, -1, -1]];
    toks[seatOf(turnUser)] = [56, 56, 56, 55];
    toks[seatOf(waiting)] = [4, -1, -1, -1];
    await setBoard(roomId, toks, seatOf(turnUser));
    __forceDice([1]);
    const rolled = (await post(turnUser, `/api/ludo/games/${roomId}/roll`, { seq: (await view(turnUser, roomId)).board.seq })).body.data;
    const won = (await post(turnUser, `/api/ludo/games/${roomId}/move`, { token: 3, seq: rolled.board.seq })).body.data;
    expect(won.status).toBe("completed");
    const winnerBalance = turnUser === A ? a0 - 1 + 2 : b0 - 1 + 2;
    expect(await balance(turnUser)).toBe(winnerBalance);
    expect(await balance(waiting)).toBe((waiting === A ? a0 : b0) - 1);
    expect((await ludoRows(waiting, "ludo_win")).filter((r) => r.sourceId.startsWith(roomId))).toHaveLength(0);
    const loserHist = (await get(waiting, "/api/ludo/history")).body.data[0];
    expect(loserHist).toMatchObject({ result: "lost", pointsSpent: 1, pointsEarned: 0 });
    // rejoining a finished game is read-only: nothing can be done
    expect((await post(waiting, `/api/ludo/games/${roomId}/roll`, { seq: 0 })).status).toBe(409);
    expect((await post(A, `/api/ludo/games/${roomId}/leave`)).status).toBe(409);
  });
});

describe("Unique Ludo: disconnection, timers and refunds", () => {
  async function liveGame() {
    await prisma.ludoDailyUsage.deleteMany({ where: { userId: { in: [A, B] } } });
    await prisma.ludoGame.updateMany({ where: { status: { in: ["active", "lobby"] }, players: { some: { userId: { in: [A, B] } } } }, data: { status: "abandoned" } });
    await grant(A, 5); await grant(B, 5);
    const id = await newRoom(A, [B], 2);
    expect((await post(A, `/api/ludo/rooms/${id}/start`)).status).toBe(200);
    return id;
  }

  it("a person who stays away past the grace time is replaced by the computer, and can take the seat back", async () => {
    const id = await liveGame();
    const seatB = (await prisma.ludoPlayer.findFirstOrThrow({ where: { gameId: id, userId: B } }));
    await prisma.ludoPlayer.update({ where: { id: seatB.id }, data: { disconnectedAt: new Date(Date.now() - cfg.graceMs - 5000) } });
    const r = await ludo.sweep();
    expect(r.takeovers).toBe(1);
    expect((await prisma.ludoPlayer.findUniqueOrThrow({ where: { id: seatB.id } })).botControl).toBe(true);
    expect((await view(A, id)).players.find((p: { botControl: boolean }) => p.botControl)).toBeTruthy();
    // nothing is skipped silently: the board is still there and B can resume
    await ludo.markOnline(B);
    const back = await prisma.ludoPlayer.findUniqueOrThrow({ where: { id: seatB.id } });
    expect(back.botControl).toBe(false);
    expect(back.disconnectedAt).toBeNull();
    expect((await view(B, id)).board.tokens).toBeTruthy();
    await post(A, `/api/ludo/games/${id}/leave`);
    await post(B, `/api/ludo/games/${id}/leave`);
  });

  it("a computer standing in for a person never earns the person's reward", async () => {
    const id = await liveGame();
    const seatB = await prisma.ludoPlayer.findFirstOrThrow({ where: { gameId: id, userId: B } });
    await prisma.ludoPlayer.update({ where: { id: seatB.id }, data: { botControl: true } });
    const toks = [[-1, -1, -1, -1], [-1, -1, -1, -1]];
    toks[seatB.seat] = [56, 56, 56, 55];
    toks[1 - seatB.seat] = [4, -1, -1, -1];
    await setBoard(id, toks, seatB.seat, { actAt: new Date() });
    const before = await balance(B);
    __forceDice([1]);
    await ludo.tick(); await ludo.tick();
    expect((await view(A, id)).status).toBe("completed");
    expect(await balance(B)).toBe(before);
    expect((await ludoRows(B, "ludo_win")).filter((r) => r.sourceId.startsWith(id))).toHaveLength(0);
  });

  it("a turn that times out is played for the person (not skipped), and three in a row hands the seat to the computer", async () => {
    const id = await liveGame();
    const g = await prisma.ludoGame.findUniqueOrThrow({ where: { id }, include: { players: true } });
    const human = g.players.find((p) => p.userId === B)!;
    const stState = g.state as unknown as { s: { turn: number } };
    stState.s.turn = human.seat;
    await prisma.ludoGame.update({ where: { id }, data: { state: stState as unknown as Prisma.InputJsonValue, turnSeat: human.seat, actAt: new Date(Date.now() - 1000) } });
    await ludo.tick();
    const after = await prisma.ludoPlayer.findUniqueOrThrow({ where: { id: human.id } });
    expect(after.missedTurns).toBe(1);
    const v = await view(A, id);
    expect(v.last.some((e: { type: string }) => e.type === "auto")).toBe(true);
    for (let i = 0; i < 2; i++) {
      const cur = await prisma.ludoGame.findUniqueOrThrow({ where: { id } });
      const s = cur.state as unknown as { s: { turn: number; phase: string } };
      s.s.turn = human.seat; s.s.phase = "roll";
      await prisma.ludoGame.update({ where: { id }, data: { state: s as unknown as Prisma.InputJsonValue, turnSeat: human.seat, actAt: new Date(Date.now() - 1000) } });
      await ludo.tick();
    }
    expect((await prisma.ludoPlayer.findUniqueOrThrow({ where: { id: human.id } })).botControl).toBe(true);
    await post(A, `/api/ludo/games/${id}/leave`);
  });

  it("when everyone leaves, the game is abandoned: no winner, no reward, no refund", async () => {
    const id = await liveGame();
    const b0 = await balance(B);
    expect((await post(B, `/api/ludo/games/${id}/leave`)).status).toBe(200);
    expect((await view(A, id)).status).toBe("active"); // A keeps playing against the computer in B's seat
    expect((await post(A, `/api/ludo/games/${id}/leave`)).status).toBe(200);
    const v = await view(A, id);
    expect(v.status).toBe("abandoned");
    expect(v.outcome.pointsEarned).toBe(0);
    expect(await balance(B)).toBe(b0);
    expect((await ludoRows(B, "ludo_win")).filter((r) => r.sourceId.startsWith(id))).toHaveLength(0);
  });

  it("a server-cancelled game refunds each fee once and gives the daily game back", async () => {
    const id = await liveGame();
    const [a0, b0] = [await balance(A), await balance(B)];
    expect(await usage(A, "multi")).toBe(1);
    await ludo.cancelWithRefund(id, "server fault");
    expect(await balance(A)).toBe(a0 + 1);
    expect(await balance(B)).toBe(b0 + 1);
    expect(await usage(A, "multi")).toBe(0);
    await expect(ludo.cancelWithRefund(id, "again")).rejects.toThrow();
    expect(await ludoRows(A, "ludo_refund")).toHaveLength(1);
    expect((await view(A, id)).status).toBe("cancelled");
  });

  it("an old empty lobby closes by itself", async () => {
    const room = (await post(A, "/api/ludo/rooms", {})).body.data;
    await prisma.ludoGame.update({ where: { id: room.id }, data: { lastActivityAt: new Date(Date.now() - cfg.lobbyIdleMs - 1000) } });
    expect((await ludo.sweep()).lobbies).toBeGreaterThanOrEqual(1);
    expect((await view(A, room.id)).status).toBe("cancelled");
  });
});

describe("Unique Ludo: leaderboard and statistics", () => {
  it("shows names and numbers only, never phone numbers, and counts only real finished games", async () => {
    const lb = (await get(A, "/api/ludo/leaderboard?mode=all&sort=wins")).body.data;
    expect(lb.rows.length).toBeGreaterThan(0);
    for (const row of lb.rows) {
      expect(Object.keys(row).sort()).toEqual(["name", "played", "rank", "winRate", "wins"]);
      expect(JSON.stringify(row)).not.toMatch(/98000008/);
    }
    expect((await api().get("/api/ludo/leaderboard")).status).toBe(401);
    expect((await get(A, "/api/ludo/rules")).body.data).toMatchObject({ entryFee: 1, winReward: 2, soloLimit: 4, multiLimit: 5 });
  });
});
