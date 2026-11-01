import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { addDaysKey, todayKey } from "../src/utils/dates";

const A = "9800000811";
const B = "9800000812";
const as = (phone: string) => bearer(tokenFor(phone));

async function wipe() {
  await prisma.healthLog.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.healthPlan.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Health A");
  await makeUser(B, "Health B");
});
afterAll(async () => {
  await wipe();
});

describe("health tracker", () => {
  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/wellness/me")).status).toBe(401);
  });

  it("starts empty with a default plan", async () => {
    const r = await api().get("/api/wellness/me").set(as(A));
    expect(r.status).toBe(200);
    expect(r.body.data.logs).toEqual([]);
    expect(r.body.data.plan.playDays).toEqual([]);
    expect(r.body.data.plan.waterGoal).toBe(8);
  });

  it("saves a check-in and replaces it when saved again for the same day", async () => {
    const first = await api().put("/api/wellness/log").set(as(A)).send({ sleepHours: 7.5, water: 6, energy: 4, mood: 5, soreness: 2 });
    expect(first.status).toBe(200);
    const again = await api().put("/api/wellness/log").set(as(A)).send({ sleepHours: 8, performance: 4 });
    expect(again.status).toBe(200);
    const me = await api().get("/api/wellness/me").set(as(A));
    expect(me.body.data.logs).toHaveLength(1);
    expect(me.body.data.logs[0].sleepHours).toBe(8);
    expect(me.body.data.logs[0].performance).toBe(4);
    expect(me.body.data.logs[0].energy).toBeNull(); // replaced, not merged
  });

  it("keeps one customer's check-ins private from another", async () => {
    const me = await api().get("/api/wellness/me").set(as(B));
    expect(me.body.data.logs).toEqual([]);
  });

  it("refuses bad numbers, empty check-ins and days outside the last 90", async () => {
    const send = (b: object) => api().put("/api/wellness/log").set(as(A)).send(b);
    expect((await send({ energy: 9 })).status).toBe(400);
    expect((await send({ sleepHours: 30 })).status).toBe(400);
    expect((await send({})).status).toBe(400);
    expect((await send({ day: addDaysKey(todayKey(), 1), mood: 3 })).status).toBe(400);
    expect((await send({ day: addDaysKey(todayKey(), -120), mood: 3 })).status).toBe(400);
    expect((await send({ day: addDaysKey(todayKey(), -3), mood: 3 })).status).toBe(200);
  });

  it("saves the play plan with clean days", async () => {
    const r = await api().put("/api/wellness/plan").set(as(A)).send({ playDays: [5, 2, 2, 9, "x"], remindHour: 7, waterGoal: 10 });
    expect(r.status).toBe(200);
    expect(r.body.data.playDays).toEqual([2, 5]);
    expect(r.body.data.remindHour).toBe(7);
    expect((await api().put("/api/wellness/plan").set(as(A)).send({ remindHour: 30 })).status).toBe(400);
  });

  it("lists the games the customer played from their bookings", async () => {
    const day = addDaysKey(todayKey(), -2);
    const b = await prisma.booking.create({ data: { userId: A, date: day, startTime: "18:00", endTime: "19:00", duration: 1, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "completed" } });
    const me = await api().get("/api/wellness/me").set(as(A));
    expect(me.body.data.games.map((g: { date: string }) => g.date)).toContain(day);
    await prisma.booking.delete({ where: { id: b.id } });
  });
});
