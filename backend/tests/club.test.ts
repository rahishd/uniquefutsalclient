import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const M = "9800000851"; // becomes a club member
const N = "9800000852"; // never a member
const ALL = [M, N];

const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);

async function wipe() {
  const bookings = (await prisma.booking.findMany({ where: { userId: { in: ALL } }, select: { id: true } })).map((b) => b.id);
  const gz = (await prisma.gzBooking.findMany({ where: { userId: { in: ALL } }, select: { code: true } })).map((g) => g.code);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: bookings } } });
  await prisma.gzSlot.deleteMany({ where: { bookingCode: { in: gz } } });
  await prisma.paymentEvent.deleteMany({ where: { orderCode: { in: [...bookings, ...gz] } } });
  await prisma.paymentOrder.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookings } } });
  await prisma.gzBooking.deleteMany({ where: { code: { in: gz } } });
  await prisma.clubMember.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(M, "Club Member");
  await makeUser(N, "Plain Player");
});
afterAll(wipe);

describe("Unique Club: joining", () => {
  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/club")).status).toBe(401);
    expect((await api().post("/api/club/join")).status).toBe(401);
  });

  it("starts as a non-member, with the price and the percentage", async () => {
    const s = (await get(M, "/api/club")).body.data;
    expect(s).toMatchObject({ fee: 1500, days: 30, percent: 10, member: false, daysLeft: 0 });
  });

  it("asks for Rs. 1,500 and shows the same QR if asked again", async () => {
    const o = await post(M, "/api/club/join");
    expect(o.status).toBe(200);
    expect(o.body.data).toMatchObject({ amount: 1500, method: "fonepay", status: "pending" });
    expect(o.body.data.orderCode).toMatch(/^CLUB-/);
    const again = await post(M, "/api/club/join");
    expect(again.body.data.orderCode).toBe(o.body.data.orderCode);
  });

  it("switches the club on for 30 days when the payment arrives, and renewing adds 30 more", async () => {
    const o = (await post(M, "/api/club/join")).body.data;
    expect((await post(M, `/api/payments/${o.orderCode}/test-pay`)).status).toBe(200);
    const s = (await get(M, "/api/club")).body.data;
    expect(s.member).toBe(true);
    expect(s.daysLeft).toBe(30);
    expect(await prisma.notification.count({ where: { userId: M, title: "Welcome to Unique Club" } })).toBe(1);

    const renew = (await post(M, "/api/club/join")).body.data;
    expect(renew.orderCode).not.toBe(o.orderCode);
    await post(M, `/api/payments/${renew.orderCode}/test-pay`);
    const s2 = (await get(M, "/api/club")).body.data;
    expect(s2.daysLeft).toBe(60);
    expect(s2.payments).toBe(2);
  });
});

describe("Unique Club: the 10% discount", () => {
  const date = futureDate(2);
  const quote = (p: string, body: object) => post(p, "/api/bookings/quote", body);

  it("takes 10% off a court booking for a member, and refuses a promo code", async () => {
    const plain = (await quote(N, { date, startTime: "18:00", duration: 1 })).body.data;
    const member = (await quote(M, { date, startTime: "18:00", duration: 1 })).body.data;
    expect(plain.club).toBeNull();
    expect(member.club).toMatchObject({ percent: 10 });
    expect(member.discount).toBe(Math.round(plain.basePrice * 0.1));
    expect(member.total).toBe(plain.basePrice - member.discount);

    const withPromo = (await quote(M, { date, startTime: "18:00", duration: 1, promoCode: "WEEKEND10" })).body.data;
    expect(withPromo.promo.ok).toBe(false);
    expect(withPromo.total).toBe(member.total);
  });

  it("records the club discount on the booking and refuses a promo code at checkout", async () => {
    const bad = await post(M, "/api/bookings/checkout", { date, startTime: "19:00", duration: 1, method: "venue", promoCode: "WEEKEND10" });
    expect(bad.status).toBe(400);
    const ok = await post(M, "/api/bookings/checkout", { date, startTime: "19:00", duration: 1, method: "venue" });
    expect(ok.status).toBe(201);
    const b = await prisma.booking.findFirstOrThrow({ where: { userId: M } });
    expect(b.clubDiscount).toBeGreaterThan(0);
    expect(b.discountAmount).toBe(b.clubDiscount);
    expect(b.promoCode).toBeNull();
    expect(b.totalPrice).toBe(b.subtotal - b.clubDiscount);
  });

  it("does not discount a customer who is not a member", async () => {
    const r = await post(N, "/api/bookings/checkout", { date, startTime: "20:00", duration: 1, method: "venue" });
    expect(r.status).toBe(201);
    const b = await prisma.booking.findFirstOrThrow({ where: { userId: N } });
    expect(b.clubDiscount).toBe(0);
  });

  it("stops the discount when the club has ended", async () => {
    await prisma.clubMember.update({ where: { userId: M }, data: { validUntil: new Date(Date.now() - 1000) } });
    const s = (await get(M, "/api/club")).body.data;
    expect(s).toMatchObject({ member: false, expired: true });
    const q = (await quote(M, { date, startTime: "18:00", duration: 1 })).body.data;
    expect(q.club).toBeNull();
  });
});

describe("Guests: court and Gamezone only, 100% online, no promo codes", () => {
  const date = futureDate(2);
  const guestBody = { name: "Walk Up", phone: "9811122233" };

  it("gives a guest the full price and says promo codes need an account", async () => {
    const q = await api().post("/api/bookings/quote").send({ date, startTime: "18:00", duration: 1, promoCode: "WEEKEND10" });
    expect(q.status).toBe(200);
    expect(q.body.data.discount).toBe(0);
    expect(q.body.data.total).toBe(q.body.data.basePrice);
    expect(q.body.data.promo).toMatchObject({ ok: false });
  });

  it("refuses a promo code and pay-at-venue from a guest at checkout", async () => {
    const promo = await api().post("/api/bookings/checkout").send({ date, startTime: "18:00", duration: 1, method: "fonepay", promoCode: "WEEKEND10", guest: guestBody });
    expect(promo.status).toBe(403);
    const venue = await api().post("/api/bookings/checkout").send({ date, startTime: "18:00", duration: 1, method: "venue", guest: guestBody });
    expect(venue.status).toBe(403);
  });
});
