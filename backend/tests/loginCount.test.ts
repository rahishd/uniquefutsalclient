import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const U = "9800000972";

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
  await makeUser(U, "Count Carl");
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
  await prisma.$disconnect();
});

describe("sign-in counter (the app hides its New tags after 5 sign-ins)", () => {
  it("starts at zero and the profile reports it", async () => {
    const me = await api().get("/api/auth/me").set(bearer(tokenFor(U)));
    expect(me.status).toBe(200);
    expect(me.body.data.loginCount).toBe(0);
  });

  it("counts each successful sign-in, and only those", async () => {
    const bad = await api().post("/api/auth/login").send({ identifier: U, password: "Wrong#Password1" });
    expect(bad.status).toBe(401);
    for (let i = 0; i < 3; i++) {
      expect((await api().post("/api/auth/login").send({ identifier: U, password: "Test#1234" })).status).toBe(200);
    }
    expect((await prisma.user.findUnique({ where: { phoneNumber: U } }))!.loginCount).toBe(3);
    const me = await api().get("/api/auth/me").set(bearer(tokenFor(U)));
    expect(me.body.data.loginCount).toBe(3);
  });

  it("a token refresh is not a sign-in", async () => {
    const login = await api().post("/api/auth/login").send({ identifier: U, password: "Test#1234" });
    const before = (await prisma.user.findUnique({ where: { phoneNumber: U } }))!.loginCount;
    const refresh = await api().post("/api/auth/refresh").send({ refreshToken: login.body.data.refreshToken });
    expect(refresh.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { phoneNumber: U } }))!.loginCount).toBe(before);
  });
});
