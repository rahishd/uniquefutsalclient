import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const P = "9800000891";

const get = (url: string) => api().get(url).set(bearer(tokenFor(P)));
const post = (url: string) => api().post(url).set(bearer(tokenFor(P))).send({});

async function wipe() {
  await prisma.loyaltyEntry.deleteMany({ where: { userId: P } });
  await prisma.notification.deleteMany({ where: { userId: P } });
  await prisma.user.deleteMany({ where: { phoneNumber: P } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(P, "Reviewer");
});
afterAll(wipe);

describe("Google review point", () => {
  it("needs a sign-in", async () => {
    expect((await api().get("/api/loyalty/review")).status).toBe(401);
    expect((await api().post("/api/loyalty/review/claim")).status).toBe(401);
  });

  it("starts unclaimed", async () => {
    const r = await get("/api/loyalty/review");
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ claimed: false, points: 1 });
  });

  it("gives 1 point the first time and nothing after", async () => {
    const a = await post("/api/loyalty/review/claim");
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ earned: true, points: 1 });
    const b = await post("/api/loyalty/review/claim");
    expect(b.status).toBe(200);
    expect(b.body.data).toMatchObject({ earned: false, points: 0, claimed: true });
    const sum = await prisma.loyaltyEntry.aggregate({ where: { userId: P, kind: "review" }, _sum: { points: true } });
    expect(Number(sum._sum.points)).toBe(1);
    expect((await get("/api/loyalty/review")).body.data.claimed).toBe(true);
  });
});
