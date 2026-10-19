import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import loyaltyService from "../src/modules/loyalty/loyalty.service";
import { todayKey, addDaysKey } from "../src/utils/dates";

const U = "9800000241";
const OTHER = "9800000242";

async function wipe() {
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: [U, OTHER] } } });
  await prisma.freeGameVoucher.deleteMany({ where: { userId: { in: [U, OTHER] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [U, OTHER] } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(U, "Voucher Cancel");
  await makeUser(OTHER, "Someone Else");
  await prisma.loyaltyEntry.create({
    data: { userId: U, kind: "membership", points: 500, earnedOn: "2026-10-01", expiresOn: null, sourceType: "seed", sourceId: "vc-seed", detail: "seed" },
  });
  await prisma.loyaltyEntry.create({
    data: { userId: U, kind: "game", points: 50, earnedOn: todayKey(), expiresOn: addDaysKey(todayKey(), 10), sourceType: "seed", sourceId: "vc-game", detail: "seed game" },
  });
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("cancelling an unused free game voucher", () => {
  it("voids the voucher and gives the points back", async () => {
    const before = (await loyaltyService.overview(U)).remaining;
    const claim = await api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Day" });
    expect(claim.status).toBe(201);
    const voucherId = claim.body.data.id as string;
    const cost = claim.body.data.cost as number;
    expect((await loyaltyService.overview(U)).remaining).toBe(before - cost);

    const res = await api().delete(`/api/loyalty/vouchers/${voucherId}`).set(bearer(tokenFor(U)));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: voucherId, period: "Day", refunded: cost });

    const after = await loyaltyService.overview(U);
    expect(after.remaining).toBe(before);
    expect(after.vouchers.some((v) => v.id === voucherId)).toBe(false);
    expect((await prisma.freeGameVoucher.findUnique({ where: { id: voucherId } }))?.status).toBe("void");
  });

  it("gives each part back with the expiry it was spent from", async () => {
    const soon = addDaysKey(todayKey(), 10);
    const claim = await api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Evening" });
    expect(claim.status).toBe(201);
    const voucherId = claim.body.data.id as string;
    const cost = claim.body.data.cost as number;
    const spent = await prisma.freeGameVoucher.findUnique({ where: { id: voucherId } });
    // the points expiring soonest are spent first, so the soon-expiring 50 are in the spent parts
    expect(JSON.parse(spent!.spent as string)[0]).toEqual({ expiresOn: soon, points: Math.min(50, cost) });

    expect((await api().delete(`/api/loyalty/vouchers/${voucherId}`).set(bearer(tokenFor(U)))).status).toBe(200);
    const refunds = await prisma.loyaltyEntry.findMany({ where: { userId: U, sourceType: "voucher_void", sourceId: { startsWith: voucherId } } });
    const total = refunds.reduce((n, r) => n + Number(r.points), 0);
    expect(total).toBeCloseTo(cost, 1);
    expect(refunds.some((r) => r.expiresOn === soon && Number(r.points) === Math.min(50, cost))).toBe(true);
  });

  it("cannot be cancelled twice, by someone else, or once it has been used", async () => {
    const claim = await api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Morning" });
    const voucherId = claim.body.data.id as string;

    expect((await api().delete(`/api/loyalty/vouchers/${voucherId}`).set(bearer(tokenFor(OTHER)))).status).toBe(404);
    expect((await api().delete(`/api/loyalty/vouchers/${voucherId}`).set(bearer(tokenFor(U)))).status).toBe(200);
    expect((await api().delete(`/api/loyalty/vouchers/${voucherId}`).set(bearer(tokenFor(U)))).status).toBe(409);

    const again = await api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Morning" });
    const usedId = again.body.data.id as string;
    await prisma.freeGameVoucher.update({ where: { id: usedId }, data: { status: "used" } });
    expect((await api().delete(`/api/loyalty/vouchers/${usedId}`).set(bearer(tokenFor(U)))).status).toBe(409);
  });

  it("needs a sign-in", async () => {
    expect((await api().delete("/api/loyalty/vouchers/anything")).status).toBe(401);
  });
});
