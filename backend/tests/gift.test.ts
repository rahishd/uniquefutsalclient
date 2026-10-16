import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000931"; // buys the gifts
const F = "9800000932"; // the friend
const G = "9800000933"; // someone else
const ghost = "9800000939"; // not registered
const ALL = [A, F, G];

const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);
const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const pay = (p: string, code: string) => post(p, `/api/payments/${code}/test-pay`);

async function wipe() {
  const gifts = await prisma.gift.findMany({ where: { OR: [{ buyerId: { in: ALL } }, { friendId: { in: ALL } }] } });
  const bookings = (await prisma.booking.findMany({ where: { userId: { in: ALL } }, select: { id: true } })).map((b) => b.id);
  const orders = [...bookings, ...gifts.map((g) => g.code)];
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: bookings } } });
  await prisma.paymentEvent.deleteMany({ where: { orderCode: { in: orders } } });
  await prisma.paymentOrder.deleteMany({ where: { OR: [{ orderCode: { in: orders } }, { userId: { in: ALL } }] } });
  await prisma.gift.deleteMany({ where: { id: { in: gifts.map((g) => g.id) } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookings } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Asha Buyer");
  await makeUser(F, "Bikash Friend");
  await makeUser(G, "Other Person");
});
afterAll(wipe);

describe("Gift Card", () => {
  it("shows the rules openly and needs a signed-in customer for the rest", async () => {
    const r = await api().get("/api/gifts/rules");
    expect(r.body.data).toEqual({ rsPerPoint: 10, minPoints: 10, maxPoints: 500, perDay: 5 });
    expect((await api().get("/api/gifts")).status).toBe(401);
    expect((await api().post("/api/gifts/points").send({ friendPhone: F, points: 10 })).status).toBe(401);
  });

  it("finds the friend by number (first name only), never yourself or an unknown number", async () => {
    const r = await get(A, `/api/gifts/friend/${F}`);
    expect(r.body.data).toEqual({ phone: F, firstName: "Bikash" });
    expect((await get(A, `/api/gifts/friend/${A}`)).status).toBe(400);
    expect((await get(A, `/api/gifts/friend/${ghost}`)).status).toBe(404);
    expect((await get(A, "/api/gifts/friend/12345")).status).toBe(400);
  });

  it("charges Rs. 10 a point and adds the points to the friend only once it is paid", async () => {
    expect((await post(A, "/api/gifts/points", { friendPhone: F, points: 5 })).status).toBe(400);
    expect((await post(A, "/api/gifts/points", { friendPhone: F, points: 501 })).status).toBe(400);
    expect((await post(A, "/api/gifts/points", { friendPhone: F, points: 12.5 })).status).toBe(400);

    const r = await post(A, "/api/gifts/points", { friendPhone: F, points: 50, message: "Happy birthday!" });
    expect(r.status).toBe(201);
    expect(r.body.data.payment).toMatchObject({ amount: 500, method: "fonepay", status: "pending" });
    expect(r.body.data.payment.remarks).toMatch(/^Gift Card points - GIFT-/);
    const code = r.body.data.gift.code;
    expect(await prisma.loyaltyEntry.count({ where: { userId: F } })).toBe(0);

    expect((await pay(A, code)).status).toBe(200);
    const entry = await prisma.loyaltyEntry.findFirst({ where: { userId: F, kind: "gift" } });
    expect(Number(entry!.points)).toBe(50);
    expect(entry!.expiresOn).not.toBeNull();
    expect(await prisma.notification.count({ where: { userId: F, title: "You got a gift" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: A, title: "Gift sent" } })).toBe(1);

    // paying twice changes nothing
    await pay(A, code);
    expect(await prisma.loyaltyEntry.count({ where: { userId: F, kind: "gift" } })).toBe(1);

    const mine = (await get(A, "/api/gifts")).body.data.gifts;
    expect(mine[0]).toMatchObject({ kind: "points", role: "sent", status: "paid", points: 50, amount: 500, otherName: "Bikash" });
    const theirs = (await get(F, "/api/gifts")).body.data.gifts;
    expect(theirs[0]).toMatchObject({ role: "received", otherName: "Asha", message: "Happy birthday!" });
  });

  it("books a game in the friend's name, paid by the buyer, and the friend cannot cancel it", async () => {
    const date = futureDate(3);
    const q = await post(A, "/api/gifts/game/quote", { friendPhone: F, date, startTime: "14:00" });
    expect(q.status).toBe(200);
    expect(q.body.data.total).toBeGreaterThan(0);

    const r = await post(A, "/api/gifts/game", { friendPhone: F, date, startTime: "14:00" });
    expect(r.status).toBe(201);
    const bookingId = r.body.data.payment.orderCode;
    expect(r.body.data.payment.amount).toBe(q.body.data.total);
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(b).toMatchObject({ userId: F, status: "pending", paymentStatus: "pending" });

    // the buyer follows the payment, the friend does not see someone else's order
    expect((await get(A, `/api/payments/${bookingId}/status`)).status).toBe(200);
    expect((await pay(A, bookingId)).status).toBe(200);
    expect(await prisma.booking.findUnique({ where: { id: bookingId } })).toMatchObject({ status: "confirmed", paymentStatus: "completed" });
    expect(await prisma.gift.findUnique({ where: { bookingId } })).toMatchObject({ status: "paid", kind: "game" });
    expect(await prisma.notification.count({ where: { userId: F, title: "You got a game as a gift" } })).toBe(1);

    expect((await post(F, `/api/bookings/${bookingId}/cancel`)).status).toBe(409);
  });

  it("an unpaid game gift releases the slot and shows as expired", async () => {
    const date = futureDate(4);
    const r = await post(A, "/api/gifts/game", { friendPhone: F, date, startTime: "15:00" });
    const bookingId = r.body.data.payment.orderCode;
    await prisma.paymentOrder.update({ where: { orderCode: bookingId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await get(A, `/api/payments/${bookingId}/status`);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))!.status).toBe("cancelled");
    expect((await prisma.gift.findUnique({ where: { bookingId } }))!.status).toBe("expired");
    // the hour is free again
    expect((await post(G, "/api/gifts/game", { friendPhone: F, date, startTime: "15:00" })).status).toBe(201);
  });

  it("allows 5 gifts a day per customer", async () => {
    const already = await prisma.gift.count({ where: { buyerId: A } });
    for (let i = already; i < 5; i++) expect((await post(A, "/api/gifts/points", { friendPhone: G, points: 10 })).status).toBe(201);
    expect((await post(A, "/api/gifts/points", { friendPhone: G, points: 10 })).status).toBe(429);
  });
});
