import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const P = "9800000881"; // watches everything
const Q = "9800000882"; // tries to touch P's views
const ALL = [P, Q];

const get = (p: string, url: string) => api().get(url).set(bearer(tokenFor(p)));
const post = (p: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(p))).send(body);

async function wipe() {
  await prisma.watchEarnView.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.watchEarnStat.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

// starts an ad and pretends its 15 seconds have passed
async function watch(p: string) {
  const v = (await post(p, "/api/watch-earn/views", { adId: "ad-1" })).body.data;
  await prisma.watchEarnView.update({ where: { id: v.viewId }, data: { startedAt: new Date(Date.now() - 16_000) } });
  return post(p, `/api/watch-earn/views/${v.viewId}/complete`);
}

const pointsOf = async (p: string) => Number((await prisma.loyaltyEntry.aggregate({ where: { userId: p, kind: "watch_earn" }, _sum: { points: true } }))._sum.points ?? 0);

beforeAll(async () => {
  await wipe();
  for (const p of ALL) await makeUser(p, `Viewer ${p.slice(-2)}`);
});
afterAll(wipe);

describe("Watch & Earn", () => {
  it("shows the rules to everyone", async () => {
    const r = await api().get("/api/watch-earn/rules");
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ adSeconds: 15, adsPerPoint: 40, pointsPerBlock: 1, minutesPerPoint: 10 });
  });

  it("needs a sign-in", async () => {
    expect((await api().post("/api/watch-earn/views")).status).toBe(401);
    expect((await api().get("/api/watch-earn/me")).status).toBe(401);
  });

  it("refuses an ad completed before its 15 seconds", async () => {
    const v = (await post(P, "/api/watch-earn/views")).body.data;
    const r = await post(P, `/api/watch-earn/views/${v.viewId}/complete`);
    expect(r.status).toBe(409);
    expect((await get(P, "/api/watch-earn/me")).body.data.totalViews).toBe(0);
  });

  it("counts an ad once, even when completed twice", async () => {
    const v = (await post(P, "/api/watch-earn/views")).body.data;
    await prisma.watchEarnView.update({ where: { id: v.viewId }, data: { startedAt: new Date(Date.now() - 16_000) } });
    const a = await post(P, `/api/watch-earn/views/${v.viewId}/complete`);
    const b = await post(P, `/api/watch-earn/views/${v.viewId}/complete`);
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({ counted: true, totalViews: 1, adsTowardNext: 1, adsLeftForNext: 39 });
    expect(b.body.data).toMatchObject({ counted: false, totalViews: 1 });
  });

  it("closes the open ad when the next one starts", async () => {
    const first = (await post(P, "/api/watch-earn/views")).body.data;
    await post(P, "/api/watch-earn/views");
    await prisma.watchEarnView.update({ where: { id: first.viewId }, data: { startedAt: new Date(Date.now() - 16_000) } });
    expect((await post(P, `/api/watch-earn/views/${first.viewId}/complete`)).status).toBe(409);
  });

  it("does not let another customer complete someone else's ad", async () => {
    const v = (await post(P, "/api/watch-earn/views")).body.data;
    await prisma.watchEarnView.update({ where: { id: v.viewId }, data: { startedAt: new Date(Date.now() - 16_000) } });
    expect((await post(Q, `/api/watch-earn/views/${v.viewId}/complete`)).status).toBe(404);
  });

  it("gives exactly 1 loyalty point on the 40th ad", async () => {
    await prisma.watchEarnView.deleteMany({ where: { userId: P } });
    await prisma.watchEarnStat.update({ where: { userId: P }, data: { views: 38 } });
    expect(await pointsOf(P)).toBe(0);

    const r39 = await watch(P);
    expect(r39.body.data).toMatchObject({ totalViews: 39, earnedNow: 0 });
    expect(await pointsOf(P)).toBe(0);

    const r40 = await watch(P);
    expect(r40.body.data).toMatchObject({ totalViews: 40, earnedNow: 1, pointsEarned: 1, adsTowardNext: 0, adsLeftForNext: 40 });
    expect(await pointsOf(P)).toBe(1);

    const entry = await prisma.loyaltyEntry.findFirstOrThrow({ where: { userId: P, kind: "watch_earn" } });
    expect(entry.expiresOn).not.toBeNull();
    expect((await prisma.notification.count({ where: { userId: P, type: "points" } }))).toBe(1);

    const r41 = await watch(P);
    expect(r41.body.data).toMatchObject({ totalViews: 41, earnedNow: 0 });
    expect(await pointsOf(P)).toBe(1);
  });

  it("writes one point per block of 40 under parallel completes", async () => {
    await prisma.watchEarnStat.update({ where: { userId: P }, data: { views: 79 } });
    await prisma.watchEarnView.deleteMany({ where: { userId: P } });
    const v = (await post(P, "/api/watch-earn/views")).body.data;
    await prisma.watchEarnView.update({ where: { id: v.viewId }, data: { startedAt: new Date(Date.now() - 16_000) } });
    await Promise.all([1, 2, 3].map(() => post(P, `/api/watch-earn/views/${v.viewId}/complete`)));
    expect(await pointsOf(P)).toBe(2);
    expect((await prisma.watchEarnStat.findUniqueOrThrow({ where: { userId: P } })).views).toBe(80);
  });
});
