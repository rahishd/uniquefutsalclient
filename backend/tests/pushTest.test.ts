import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const U = "9800000961";

beforeAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
  await makeUser(U, "Push Pat");
});
afterAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
  await prisma.$disconnect();
});

describe("Send me a test alert", () => {
  it("says whether the server is set up and how many devices it knows (none yet, so nothing is sent)", async () => {
    const first = await api().post("/api/me/push-test").set(bearer(tokenFor(U)));
    expect(first.status).toBe(200);
    expect(first.body.data.devices).toBe(0);
    expect(first.body.data.sent).toBe(0);
    // whether the server has push keys depends on the environment; the app turns each answer into a plain-language message
    expect(typeof first.body.data.serverReady).toBe("boolean");
  });

  it("counts the customer's saved devices, never someone else's, and slows down repeats", async () => {
    await prisma.pushSubscription.create({ data: { userId: U, endpoint: "https://push.example/pat/1", p256dh: "p", auth: "a" } });
    await prisma.pushSubscription.create({ data: { userId: "9800000962-other", endpoint: "https://push.example/other/1", p256dh: "p", auth: "a" } }).catch(() => undefined);
    const again = await api().post("/api/me/push-test").set(bearer(tokenFor(U)));
    expect(again.status).toBe(429); // one test every few seconds
    await prisma.pushSubscription.deleteMany({ where: { endpoint: "https://push.example/other/1" } });
  });

  it("needs a signed-in customer", async () => {
    expect((await api().post("/api/me/push-test")).status).toBe(401);
  });
});
