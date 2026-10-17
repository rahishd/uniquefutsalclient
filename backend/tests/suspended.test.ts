import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { JwtUtil } from "../src/utils/jwt";

const U = "9800000971";
const get = (url: string) => api().get(url).set(bearer(tokenFor(U)));

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
  await makeUser(U, "Suspend Sam");
});
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
  await prisma.$disconnect();
});

describe("a suspended account can do nothing", () => {
  it("works normally while the account is active", async () => {
    expect((await get("/api/me/profile")).status).toBe(200);
    expect((await get("/api/notifications")).status).toBe(200);
  });

  it("is stopped on every route, even with a sign-in that is still valid", async () => {
    await prisma.user.update({ where: { phoneNumber: U }, data: { isActive: false } });
    for (const url of ["/api/me/profile", "/api/notifications", "/api/bookings/me", "/api/player-requests", "/api/me/payments"]) {
      const r = await get(url);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("ACCOUNT_SUSPENDED");
      expect(r.body.message).toMatch(/suspended/i);
    }
    // writing is stopped too
    const post = await api().post("/api/player-requests").set(bearer(tokenFor(U))).send({ date: "2030-01-01", hour: 18, players: 2 });
    expect(post.status).toBe(403);
  });

  it("cannot sign in or refresh a sign-in", async () => {
    const login = await api().post("/api/auth/login").send({ identifier: U, password: "Test#1234" });
    expect(login.status).toBe(403);
    expect(login.body.message).toMatch(/suspended/i);
    const refresh = await api().post("/api/auth/refresh").send({ refreshToken: JwtUtil.signRefresh({ id: U, email: undefined, role: "user" }) });
    expect(refresh.status).toBe(403);
  });

  it("does not get to act as a guest either (a booking route that allows guests)", async () => {
    const r = await api().get("/api/bookings/slots?date=2030-01-01").set(bearer(tokenFor(U)));
    // slots is public and ignores the sign-in; a route that reads the sign-in when there is one must refuse
    const guestRoute = await api().post("/api/auth/signup").set(bearer(tokenFor(U))).send({ name: "x", phoneNumber: "9800000972", password: "secret1", dateOfBirth: "2000-01-01" });
    expect([200, 400]).toContain(r.status);
    expect(guestRoute.status).toBe(403);
  });

  it("works again when the account is switched back on", async () => {
    await prisma.user.update({ where: { phoneNumber: U }, data: { isActive: true } });
    expect((await get("/api/me/profile")).status).toBe(200);
    const login = await api().post("/api/auth/login").send({ identifier: U, password: "Test#1234" });
    expect(login.status).toBe(200);
  });
});
