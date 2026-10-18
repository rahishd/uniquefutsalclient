import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const U = "9800000973";
const V = "9800000974";
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(d); };
const post = (user: string, body: object) => api().post("/api/wheelchair").set(bearer(tokenFor(user))).send(body);

async function wipe() {
  await prisma.wheelchairRequest.deleteMany({ where: { userId: { in: [U, V] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [U, V] } } });
}
beforeAll(async () => {
  await wipe();
  await makeUser(U, "Wheel Wendy");
  await makeUser(V, "Other Owen");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("wheelchair requests", () => {
  it("shows the form options to anyone", async () => {
    const r = await api().get("/api/wheelchair/options");
    expect(r.status).toBe(200);
    expect(r.body.data.maxPeople).toBeGreaterThan(0);
  });

  it("needs a signed-in customer", async () => {
    expect((await api().post("/api/wheelchair").send({ date: tomorrow(), time: "18:00" })).status).toBe(401);
    expect((await api().get("/api/wheelchair/me")).status).toBe(401);
  });

  it("takes a request and lists it for that customer only", async () => {
    const res = await post(U, { date: tomorrow(), time: "18:30", people: 2, note: "Need a ramp at the entrance" });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^WC-[A-Z0-9]{6}$/);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.people).toBe(2);
    const mine = await api().get("/api/wheelchair/me").set(bearer(tokenFor(U)));
    expect(mine.body.data).toHaveLength(1);
    expect((await api().get("/api/wheelchair/me").set(bearer(tokenFor(V)))).body.data).toHaveLength(0);
  });

  it("refuses a bad day, time, group size or another customer's booking", async () => {
    expect((await post(U, { date: "2020-01-01", time: "18:00" })).status).toBe(400);
    expect((await post(U, { date: "not-a-date", time: "18:00" })).status).toBe(400);
    expect((await post(U, { date: tomorrow(), time: "25:99" })).status).toBe(400);
    expect((await post(U, { date: tomorrow(), time: "18:00", people: 99 })).status).toBe(400);
    expect((await post(U, { date: tomorrow(), time: "18:00", note: "x".repeat(501) })).status).toBe(400);
    expect((await post(U, { date: tomorrow(), time: "18:00", bookingCode: "UF-NOTMINE" })).status).toBe(400);
  });

  it("limits how many a customer can send in a day", async () => {
    await prisma.wheelchairRequest.deleteMany({ where: { userId: V } });
    for (let i = 0; i < 3; i++) expect((await post(V, { date: tomorrow(), time: "17:00" })).status).toBe(201);
    expect((await post(V, { date: tomorrow(), time: "17:00" })).status).toBe(429);
  });

  it("lets the customer cancel a waiting request, once, and nobody else's", async () => {
    const mine = (await api().get("/api/wheelchair/me").set(bearer(tokenFor(U)))).body.data[0];
    expect((await api().post(`/api/wheelchair/${mine.id}/cancel`).set(bearer(tokenFor(V)))).status).toBe(404);
    const done = await api().post(`/api/wheelchair/${mine.id}/cancel`).set(bearer(tokenFor(U)));
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe("cancelled");
    expect((await api().post(`/api/wheelchair/${mine.id}/cancel`).set(bearer(tokenFor(U)))).status).toBe(409);
  });
});
