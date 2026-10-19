import { api, adminToken, bearer, makeUser, prisma, tokenFor } from "./helpers";
import loyaltyService from "../src/modules/loyalty/loyalty.service";
import { LedgerRow, planShare } from "../src/utils/loyaltyPoints";
import { addDaysKey, todayKey } from "../src/utils/dates";

const U = "9800000211"; // sends
const F = "9800000212"; // receives
const X = "9800000213"; // no account
const ALL = [U, F];

const today = todayKey();
const soon = addDaysKey(today, 10);
const later = addDaysKey(today, 60);

async function wipe() {
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [...ALL, X] } } });
}

const seed = (id: string, kind: string, points: number, expiresOn: string | null) =>
  prisma.loyaltyEntry.create({ data: { userId: U, kind, points, earnedOn: today, expiresOn, sourceType: "seed", sourceId: id, detail: `seed ${id}` } });

const share = (points: unknown, friendPhone: unknown = F, who = U) =>
  api().post("/api/loyalty/share").set(bearer(tokenFor(who))).send({ friendPhone, points });

beforeAll(async () => {
  await wipe();
  await makeUser(U, "Rahish Giver");
  await makeUser(F, "Friend Taker");
  await seed("a", "game", 10, soon);
  await seed("b", "goods", 20, later);
  await seed("c", "membership", 5, null);
  await seed("t", "membership", 300, null); // sharing needs at least 100 points
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("planShare (the rule)", () => {
  const row = (id: string, points: number, expiresOn: string | null): LedgerRow => ({ id, kind: "game", points, earnedOn: today, expiresOn, detail: id });

  it("takes the soonest-expiring points first and keeps each part's expiry", () => {
    const ledger = [row("a", 10, soon), row("b", 20, later), row("c", 5, null)];
    expect(planShare(ledger, today, 15)).toEqual([{ expiresOn: soon, points: 10 }, { expiresOn: later, points: 5 }]);
    expect(planShare(ledger, today, 35)).toEqual([{ expiresOn: soon, points: 10 }, { expiresOn: later, points: 20 }, { expiresOn: null, points: 5 }]);
  });

  it("is empty when the valid balance is too small, and expired points never count", () => {
    const ledger = [row("a", 10, soon), row("old", 50, addDaysKey(today, -1))];
    expect(planShare(ledger, today, 11)).toEqual([]);
    expect(planShare(ledger, today, 10)).toEqual([{ expiresOn: soon, points: 10 }]);
  });
});

describe("sharing points", () => {
  it("moves the points, keeps their expiry, and tells both people", async () => {
    const res = await share(10);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ points: 10, to: "Friend", remaining: 325 });

    const mine = await loyaltyService.overview(U);
    expect(mine.remaining).toBe(325);
    expect(mine.rows.find((r) => r.kind === "shared_out")).toMatchObject({ points: -10, detail: "Shared with Friend" });

    const theirs = await loyaltyService.overview(F);
    expect(theirs.remaining).toBe(10);
    expect(theirs.byType.shared.points).toBe(10);
    expect(theirs.byType.shared.nextExpiry).toBe(soon); // the points were not made to last longer
    const got = (await prisma.loyaltyEntry.findMany({ where: { userId: F, kind: "shared_in" }, orderBy: { expiresOn: "asc" } })).map((e) => [Number(e.points), e.expiresOn]);
    expect(got).toEqual([[10, soon]]);

    const n = await api().get("/api/notifications").set(bearer(tokenFor(F)));
    expect(n.body.data.items.some((i: { title: string; href: string }) => i.title === "Points received" && i.href.startsWith("/points?hl="))).toBe(true);
    const m = await api().get("/api/notifications").set(bearer(tokenFor(U)));
    expect(m.body.data.items.some((i: { title: string }) => i.title === "Points shared")).toBe(true);
  });

  it("never-expiring points stay never-expiring for the friend", async () => {
    await prisma.loyaltyEntry.deleteMany({ where: { userId: U } });
    await seed("n", "membership", 100, null);
    const res = await share(10);
    expect(res.status).toBe(201);
    const e = await prisma.loyaltyEntry.findFirst({ where: { userId: F, kind: "shared_in", expiresOn: null } });
    expect(Number(e?.points)).toBe(10);
    expect((await loyaltyService.overview(U)).remaining).toBe(90);
  });

  it("is refused without enough points, for a bad amount, or for a bad friend", async () => {
    await prisma.loyaltyEntry.deleteMany({ where: { userId: U } }); // back to no points
    expect((await share(10)).status).toBe(409);
    await seed("d", "game", 99, later); // one short of the minimum
    expect((await share(10)).status).toBe(409);
    await seed("d2", "game", 1, later);
    expect((await share(0)).status).toBe(400);
    expect((await share(1.5)).status).toBe(400);
    expect((await share(5)).status).toBe(400); // one share sends exactly 10
    expect((await share(11)).status).toBe(400);
    expect((await share(10, U)).status).toBe(400); // yourself
    expect((await share(10, "12345")).status).toBe(400);
    expect((await share(10, X)).status).toBe(404); // nobody registered with this number
    await prisma.user.update({ where: { phoneNumber: F }, data: { isActive: false } });
    expect((await share(10)).status).toBe(404);
    await prisma.user.update({ where: { phoneNumber: F }, data: { isActive: true } });
  });

  it("asks you to sign in, and is for customers only", async () => {
    expect((await api().post("/api/loyalty/share").send({ friendPhone: F, points: 10 })).status).toBe(401);
    expect((await api().post("/api/loyalty/share").set(bearer(adminToken())).send({ friendPhone: F, points: 10 })).status).toBe(403);
    expect((await api().get(`/api/loyalty/share/friend/${F}`).set(bearer(tokenFor(U)))).body.data).toEqual({ phone: F, firstName: "Friend" });
    expect((await api().get(`/api/loyalty/share/friend/${F}`)).status).toBe(401);
  });

  it("two shares at once cannot give away the same points twice", async () => {
    // exactly 100 points: once one share has gone out the balance is under 100, so the other must be refused
    await prisma.loyaltyEntry.deleteMany({ where: { userId: U } });
    await seed("r", "membership", 100, null);
    const [a, b] = await Promise.all([share(10), share(10)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await loyaltyService.overview(U)).remaining).toBe(90);
  });

  it("allows only 3 shares a day", async () => {
    await prisma.loyaltyEntry.deleteMany({ where: { userId: U } });
    await seed("e", "membership", 130, null);
    for (let i = 0; i < 3; i++) expect((await share(10)).status).toBe(201);
    expect((await share(10)).status).toBe(429);
  });
});

describe("the sharing rules: 100 points to start, 10 points a share, 3 shares a day", () => {
  const reset = async (points: number) => {
    await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: ALL } } });
    if (points > 0) await seed("rule", "membership", points, null);
  };

  it("tells the app the limits", async () => {
    await reset(0);
    expect((await loyaltyService.overview(U)).share).toEqual({ min: 10, max: 10, minBalance: 100, perDay: 3 });
  });

  it("refuses below 100 points and allows from exactly 100", async () => {
    await reset(99);
    const no = await share(10);
    expect(no.status).toBe(409);
    expect(no.body.message).toMatch(/at least 100 points/);
    expect((await loyaltyService.overview(U)).remaining).toBe(99); // nothing moved
    await reset(100);
    expect((await share(10)).status).toBe(201);
  });

  it("sends exactly 10 points in one share", async () => {
    await reset(1000);
    const over = await share(100);
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/10 points/);
    expect((await share(10)).status).toBe(201);
    expect((await loyaltyService.overview(U)).remaining).toBe(990);
  });
});
