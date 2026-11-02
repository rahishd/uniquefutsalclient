import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000821";
const B = "9800000822";
const as = (phone: string) => bearer(tokenFor(phone));

async function wipe() {
  await prisma.pointsOffer.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Offer A");
  await makeUser(B, "Offer B");
});
afterAll(async () => {
  await wipe();
});

describe("points offered by staff", () => {
  it("shows a pending offer in my points and adds nothing until I take it", async () => {
    const offer = await prisma.pointsOffer.create({ data: { userId: A, points: 12.5, reason: "Thanks for the rain delay", createdBy: "staff" } });
    const me = await api().get("/api/loyalty/me").set(as(A));
    expect(me.body.data.remaining).toBe(0);
    expect(me.body.data.offers).toEqual([expect.objectContaining({ id: offer.id, points: 12.5, reason: "Thanks for the rain delay" })]);
  });

  it("adds the points once when I tap Add to my points, worded as a staff gift", async () => {
    const offer = await prisma.pointsOffer.findFirstOrThrow({ where: { userId: A } });
    const first = await api().post(`/api/loyalty/offers/${offer.id}/claim`).set(as(A));
    expect(first.status).toBe(201);
    const again = await api().post(`/api/loyalty/offers/${offer.id}/claim`).set(as(A));
    expect(again.status).toBe(409);
    const me = await api().get("/api/loyalty/me").set(as(A));
    expect(me.body.data.remaining).toBe(12.5);
    expect(me.body.data.offers).toEqual([]);
    expect(me.body.data.rows[0].detail).toBe("Adjustment: Thanks for the rain delay");
  });

  it("does not let another customer take my offer, or a withdrawn one", async () => {
    const mine = await prisma.pointsOffer.create({ data: { userId: A, points: 5, reason: "Meant for A only", createdBy: "staff" } });
    expect((await api().post(`/api/loyalty/offers/${mine.id}/claim`).set(as(B))).status).toBe(404);
    const gone = await prisma.pointsOffer.create({ data: { userId: B, points: 5, reason: "Taken back by staff", status: "withdrawn", createdBy: "staff" } });
    expect((await api().post(`/api/loyalty/offers/${gone.id}/claim`).set(as(B))).status).toBe(409);
    expect((await api().post(`/api/loyalty/offers/${mine.id}/claim`)).status).toBe(401);
  });
});
