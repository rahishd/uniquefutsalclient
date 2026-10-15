import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const POSTER = "9800000821";
const P2 = "9800000822";
const P3 = "9800000823";
const P4 = "9800000824";
const ALL = [POSTER, P2, P3, P4];
const DATE = futureDate(2);
const HOUR = 18;

const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);

async function wipe() {
  const bookings = (await prisma.booking.findMany({ where: { userId: { in: ALL } }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: bookings } } });
  await prisma.paymentEvent.deleteMany({ where: { orderCode: { in: bookings } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: bookings } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookings } } });
  const reqs = await prisma.playerRequest.findMany({ where: { userId: { in: ALL } }, select: { id: true } });
  for (const r of reqs) await prisma.notification.deleteMany({ where: { dedupeKey: { startsWith: `players-${r.id}-` } } });
  await prisma.playerRequest.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  await wipe();
  await makeUser(POSTER, "Rahish Dumre");
  await makeUser(P2, "Player Two");
  await makeUser(P3, "Player Three");
  await makeUser(P4, "Player Four");
});
afterAll(wipe);

describe("Find Player: posting a request", () => {
  let id = "";

  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/player-requests")).status).toBe(401);
    expect((await api().post("/api/player-requests").send({ date: DATE, hour: HOUR, players: 3 })).status).toBe(401);
  });

  it("checks the number of players, the date and the time", async () => {
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: HOUR, players: 0 })).status).toBe(400);
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: HOUR, players: 12 })).status).toBe(400); // 11 is the most
    expect((await post(POSTER, "/api/player-requests", { date: futureDate(7), hour: HOUR, players: 3 })).status).toBe(400); // only the next 6 days
    expect((await post(POSTER, "/api/player-requests", { date: futureDate(0), hour: HOUR, players: 3 })).status).toBe(400); // never today
    expect((await post(POSTER, "/api/player-requests", { date: "2020-01-01", hour: HOUR, players: 3 })).status).toBe(400);
    expect((await post(POSTER, "/api/player-requests", { date: futureDate(40), hour: HOUR, players: 3 })).status).toBe(400);
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: 3, players: 3 })).status).toBe(400); // not an open hour
  });

  it("posts a request for 3 players and tells every other registered customer", async () => {
    const r = await post(POSTER, "/api/player-requests", { date: DATE, hour: HOUR, players: 3, note: "  Friendly, bring a white shirt.  " });
    expect(r.status).toBe(201);
    id = r.body.data.id;

    let notice = null;
    for (let i = 0; i < 20 && !notice; i++) {
      notice = await prisma.notification.findFirst({ where: { userId: P2, type: "players", href: `/find-player/${id}` } });
      if (!notice) await sleep(250);
    }
    expect(notice?.message).toBe("Rahish Dumre needs 3 Players for Upcoming Game. View the deal");
    // the poster does not get their own broadcast
    expect(await prisma.notification.count({ where: { userId: POSTER, type: "players", href: `/find-player/${id}` } })).toBe(0);
  });

  it("refuses the same time twice", async () => {
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: HOUR, players: 2 })).status).toBe(409);
  });

  it("shows the deal with spots left, and who joined only to the poster", async () => {
    const asP2 = (await get(P2, `/api/player-requests/${id}`)).body.data;
    expect(asP2).toMatchObject({ posterName: "Rahish Dumre", playersNeeded: 3, joined: 0, spotsLeft: 3, mine: false, status: "open", note: "Friendly, bring a white shirt." });
    expect(asP2.joiners).toBeUndefined();
    const listed = (await get(P3, "/api/player-requests")).body.data;
    expect(listed.some((x: { id: string }) => x.id === id)).toBe(true);
  });
});

describe("Find Player: joining", () => {
  let id = "";
  beforeAll(async () => {
    id = (await prisma.playerRequest.findFirstOrThrow({ where: { userId: POSTER } })).id;
  });

  it("lets players join until the spots are gone, and counts down", async () => {
    const a = await post(P2, `/api/player-requests/${id}/join`);
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({ joined: 1, spotsLeft: 2, joinedByMe: true, status: "open" });
    expect((await post(P2, `/api/player-requests/${id}/join`)).status).toBe(409); // not twice
    expect((await post(POSTER, `/api/player-requests/${id}/join`)).status).toBe(400); // not your own
    await post(P3, `/api/player-requests/${id}/join`);
    const poster = (await get(POSTER, `/api/player-requests/${id}`)).body.data;
    expect(poster.joiners.map((j: { name: string }) => j.name).sort()).toEqual(["Player Three", "Player Two"]);
    // the poster is told about each join
    expect(await prisma.notification.count({ where: { userId: POSTER, type: "players" } })).toBeGreaterThanOrEqual(2);
  });

  it("closes the request when full and refuses further joins", async () => {
    // one more spot, then a 4th customer is turned away
    await prisma.playerRequestJoin.deleteMany({ where: { requestId: id, userId: P3 } });
    await post(P3, `/api/player-requests/${id}/join`);
    const full = await post(P4, `/api/player-requests/${id}/join`);
    expect(full.status).toBe(200);
    expect(full.body.data).toMatchObject({ joined: 3, spotsLeft: 0, status: "awaiting_advance" });
    const extra = await makeUser("9800000825", "Late Player");
    expect(extra.phoneNumber).toBe("9800000825");
    expect((await post("9800000825", `/api/player-requests/${id}/join`)).status).toBe(400);
    await prisma.user.deleteMany({ where: { phoneNumber: "9800000825" } });
  });

  it("reopens a spot when someone leaves", async () => {
    const left = await post(P4, `/api/player-requests/${id}/leave`);
    expect(left.body.data).toMatchObject({ joined: 2, spotsLeft: 1, status: "open", joinedByMe: false });
  });

  it("only the poster can cancel, and the joiners are told", async () => {
    expect((await post(P2, `/api/player-requests/${id}/cancel`)).status).toBe(403);
    const c = await post(POSTER, `/api/player-requests/${id}/cancel`);
    expect(c.body.data.status).toBe("cancelled");
    expect(await prisma.notification.count({ where: { userId: P2, type: "players", title: "Game cancelled" } })).toBe(1);
    expect((await post(P4, `/api/player-requests/${id}/join`)).status).toBe(400);
  });
});

describe("Find Player: the host's advance books the court", () => {
  let id = "";
  const D = futureDate(3);
  const H = 20;

  it("shows the equal split of the court price (host included), win or lose", async () => {
    const r = await post(P2, "/api/player-requests", { date: D, hour: H, players: 2 });
    expect(r.status).toBe(201);
    id = r.body.data.id;
    const d = (await get(P3, `/api/player-requests/${id}`)).body.data;
    expect(d.everyone).toBe(3);
    expect(d.advanceFee).toBe(300);
    expect(d.courtPrice).toBeGreaterThan(0);
    expect(d.sharePerPlayer).toBe(Math.round(d.courtPrice / 3));
    expect(d.hostShare + d.sharePerPlayer * 2).toBe(d.courtPrice);
  });

  it("only asks for the advance once everyone has joined, and only from the host", async () => {
    expect((await post(P2, `/api/player-requests/${id}/advance`)).status).toBe(400); // nobody joined yet
    await post(P3, `/api/player-requests/${id}/join`);
    expect((await post(P2, `/api/player-requests/${id}/advance`)).status).toBe(400); // one spot still open
    const full = await post(P4, `/api/player-requests/${id}/join`);
    expect(full.body.data.status).toBe("awaiting_advance");
    expect(full.body.data.advanceDueAt).toBeTruthy();
    expect((await post(P3, `/api/player-requests/${id}/advance`)).status).toBe(403);
  });

  it("the host pays Rs. 300 online: the court is booked and the rest is paid at the venue", async () => {
    const order = await post(P2, `/api/player-requests/${id}/advance`);
    expect(order.status).toBe(200);
    expect(order.body.data).toMatchObject({ amount: 300, method: "fonepay", status: "pending" });
    // asking again shows the same QR, it does not make a second booking
    const again = await post(P2, `/api/player-requests/${id}/advance`);
    expect(again.body.data.orderCode).toBe(order.body.data.orderCode);

    const paid = await post(P2, `/api/payments/${order.body.data.orderCode}/test-pay`);
    expect(paid.status).toBe(200);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: order.body.data.orderCode } });
    expect(booking).toMatchObject({ status: "confirmed", paymentStatus: "partially_paid", amountPaidNow: 300, userId: P2 });
    expect(booking.remainingAmount).toBe(booking.totalPrice - 300);

    const deal = (await get(P2, `/api/player-requests/${id}`)).body.data;
    expect(deal.status).toBe("confirmed");
    expect(await prisma.notification.count({ where: { userId: P3, title: "Game confirmed" } })).toBe(1);
  });

  it("does not let a joined player leave once the court is booked", async () => {
    expect((await post(P3, `/api/player-requests/${id}/leave`)).status).toBe(400);
  });

  it("closes a request when the advance is not paid in time", async () => {
    const r = await post(P3, "/api/player-requests", { date: D, hour: 21, players: 1 });
    const rid = r.body.data.id;
    await post(P4, `/api/player-requests/${rid}/join`);
    await prisma.playerRequest.update({ where: { id: rid }, data: { advanceDueAt: new Date(Date.now() - 1000) } });
    const seen = (await get(P4, `/api/player-requests/${rid}`)).body.data;
    expect(seen.status).toBe("cancelled");
    expect(await prisma.notification.count({ where: { userId: P4, title: "Game cancelled" } })).toBeGreaterThanOrEqual(1);
  });
});

describe("Find Player: limits", () => {
  it("allows 3 requests a day", async () => {
    // the first request above was 1; two more are allowed, the 4th is refused
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: 19, players: 1 })).status).toBe(201);
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: 20, players: 1 })).status).toBe(201);
    expect((await post(POSTER, "/api/player-requests", { date: DATE, hour: 21, players: 1 })).status).toBe(429);
  });
});
