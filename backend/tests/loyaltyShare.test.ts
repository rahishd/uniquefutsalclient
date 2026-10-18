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
    const res = await share(15);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ points: 15, to: "Friend", remaining: 20 });

    const mine = await loyaltyService.overview(U);
    expect(mine.remaining).toBe(20);
    expect(mine.rows.find((r) => r.kind === "shared_out")).toMatchObject({ points: -15, detail: "Shared with Friend" });

    const theirs = await loyaltyService.overview(F);
    expect(theirs.remaining).toBe(15);
    expect(theirs.byType.shared.points).toBe(15);
    expect(theirs.byType.shared.nextExpiry).toBe(soon); // the points were not made to last longer
    const got = (await prisma.loyaltyEntry.findMany({ where: { userId: F, kind: "shared_in" }, orderBy: { expiresOn: "asc" } })).map((e) => [Number(e.points), e.expiresOn]);
    expect(got).toEqual([[10, soon], [5, later]]);

    const n = await api().get("/api/notifications").set(bearer(tokenFor(F)));
    expect(n.body.data.items.some((i: { title: string; href: string }) => i.title === "Points received" && i.href.startsWith("/points?hl="))).toBe(true);
    const m = await api().get("/api/notifications").set(bearer(tokenFor(U)));
    expect(m.body.data.items.some((i: { title: string }) => i.title === "Points shared")).toBe(true);
  });

  it("never-expiring points stay never-expiring for the friend", async () => {
    await share(15); // the rest of the later points; only the never-expiring 5 are left
    const res = await share(5);
    expect(res.status).toBe(201);
    const e = await prisma.loyaltyEntry.findFirst({ where: { userId: F, kind: "shared_in", expiresOn: null } });
    expect(Number(e?.points)).toBe(5);
    expect((await loyaltyService.overview(U)).remaining).toBe(0);
  });

  it("is refused without enough points, for a bad amount, or for a bad friend", async () => {
    expect((await share(1)).status).toBe(409);
    await seed("d", "game", 10, later);
    expect((await share(0)).status).toBe(400);
    expect((await share(1.5)).status).toBe(400);
    expect((await share(501)).status).toBe(400);
    expect((await share(5, U)).status).toBe(400); // yourself
    expect((await share(5, "12345")).status).toBe(400);
    expect((await share(5, X)).status).toBe(404); // nobody registered with this number
    await prisma.user.update({ where: { phoneNumber: F }, data: { isActive: false } });
    expect((await share(5)).status).toBe(404);
    await prisma.user.update({ where: { phoneNumber: F }, data: { isActive: true } });
  });

  it("asks you to sign in, and is for customers only", async () => {
    expect((await api().post("/api/loyalty/share").send({ friendPhone: F, points: 1 })).status).toBe(401);
    expect((await api().post("/api/loyalty/share").set(bearer(adminToken())).send({ friendPhone: F, points: 1 })).status).toBe(403);
    expect((await api().get(`/api/loyalty/share/friend/${F}`).set(bearer(tokenFor(U)))).body.data).toEqual({ phone: F, firstName: "Friend" });
    expect((await api().get(`/api/loyalty/share/friend/${F}`)).status).toBe(401);
  });

  it("two shares at once cannot give away the same points twice", async () => {
    // U now holds 10 valid points (seed d)
    const [a, b] = await Promise.all([share(10), share(10)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await loyaltyService.overview(U)).remaining).toBe(0);
  });

  it("allows only a few shares a day", async () => {
    await prisma.loyaltyEntry.deleteMany({ where: { userId: U, kind: "shared_out" } });
    await seed("e", "game", 50, later);
    for (let i = 0; i < 5; i++) expect((await share(1)).status).toBe(201);
    expect((await share(1)).status).toBe(429);
  });
});
