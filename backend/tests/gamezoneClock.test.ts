import { sendGamezoneClockNotices } from "../src/jobs/app.jobs";
import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { todayKey } from "../src/utils/dates";

const REG = "9800000411";
const GUEST = "9800000412";
const MIN = 60000;

// The clock table belongs to the admin portal (its migration creates it). The test makes the same table so the app can be checked alone.
const CREATE = `CREATE TABLE IF NOT EXISTS "GzClock" ("bookingCode" TEXT PRIMARY KEY, "startedAt" TIMESTAMP(3) NOT NULL, "endedAt" TIMESTAMP(3), "bookedMinutes" INTEGER NOT NULL, "hourlyRate" INTEGER NOT NULL, "extraMinutes" INTEGER NOT NULL DEFAULT 0, "extraCharge" INTEGER NOT NULL DEFAULT 0, "prepaid" INTEGER NOT NULL DEFAULT 0, "startedBy" TEXT NOT NULL)`;

const CODES = ["GZC-SOON", "GZC-LATER", "GZC-OVER", "GZC-GUEST", "GZC-DONE"];

async function wipe() {
  await prisma.$executeRawUnsafe(CREATE);
  await prisma.$executeRawUnsafe(`DELETE FROM "GzClock" WHERE "bookingCode" LIKE 'GZC-%'`);
  await prisma.gzBooking.deleteMany({ where: { code: { in: CODES } } });
  await prisma.notification.deleteMany({ where: { userId: REG } });
  await prisma.user.deleteMany({ where: { phoneNumber: REG } });
}

// The admin writes these times through Prisma, as UTC with no zone. The test does the same (a bare Date would be shifted by the database time zone).
const utc = (ms: number) => new Date(ms).toISOString().slice(0, -1);

// A session whose clock started `ranMinutes` ago and was booked for `bookedMinutes`
async function running(code: string, ranMinutes: number, o: { userId?: string | null; bookedMinutes?: number; hourlyRate?: number } = {}) {
  await prisma.gzBooking.create({
    data: { code, userId: o.userId === undefined ? REG : o.userId, guestName: o.userId === null ? "Guest" : null, consoleId: "c-clock", gameTitle: "FIFA 26", date: todayKey(), startHour: 11, hours: 1, players: 1, total: 300, paymentMethod: "venue", paymentStatus: "pay_at_venue", status: "confirmed" },
  });
  await prisma.$executeRaw`INSERT INTO "GzClock" ("bookingCode", "startedAt", "bookedMinutes", "hourlyRate", "startedBy") VALUES (${code}, CAST(${utc(Date.now() - ranMinutes * MIN)} AS TIMESTAMP), ${o.bookedMinutes ?? 60}, ${o.hourlyRate ?? 300}, 'staff-test')`;
}

const notices = (userId = REG) => prisma.notification.findMany({ where: { userId, type: "gamezone" }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  await wipe();
  await makeUser(REG, "Clock Gamer");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("Gamezone session clock for the customer", () => {
  it("warns once, about 5 minutes before the time ends, with the per-minute price", async () => {
    await running("GZC-SOON", 56); // 4 minutes left of 60
    await running("GZC-LATER", 20); // 40 minutes left: too early
    await sendGamezoneClockNotices();
    const first = await notices();
    expect(first).toHaveLength(1);
    expect(first[0].title).toBe("Your PS5 session ends in 4 minutes");
    expect(first[0].message).toContain("Rs. 5 per minute");
    expect(first[0].href).toBe("/booking/GZC-SOON");
    await sendGamezoneClockNotices(); // every minute: still one notice
    expect(await notices()).toHaveLength(1);
  });

  it("tells the customer when the time is up and the per-minute charge has started", async () => {
    await running("GZC-OVER", 63);
    await sendGamezoneClockNotices();
    const over = (await notices()).find((n) => n.dedupeKey === "gz-over-GZC-OVER");
    expect(over?.title).toBe("Your PS5 time is up");
    expect(over?.message).toContain("Rs. 5 per minute");
  });

  it("sends nothing to guests or to a session that was already stopped", async () => {
    await running("GZC-GUEST", 56, { userId: null });
    await running("GZC-DONE", 56);
    await prisma.$executeRaw`UPDATE "GzClock" SET "endedAt" = (now() AT TIME ZONE 'UTC') WHERE "bookingCode" = 'GZC-DONE'`;
    const before = (await notices()).length;
    await sendGamezoneClockNotices();
    expect(await notices()).toHaveLength(before);
    expect(await prisma.notification.count({ where: { dedupeKey: { in: ["gz-warn-GZC-GUEST", "gz-warn-GZC-DONE"] } } })).toBe(0);
  });

  it("shows the clock, with the server's time, on the customer's booking list", async () => {
    const res = await api().get("/api/gamezone/bookings/me").set(bearer(tokenFor(REG)));
    expect(res.status).toBe(200);
    const row = res.body.data.find((b: { code: string }) => b.code === "GZC-OVER");
    expect(row.clock.bookedMinutes).toBe(60);
    expect(row.clock.hourlyRate).toBe(300);
    expect(row.clock.endedAt).toBeNull();
    expect(Math.abs(Date.parse(row.clock.now) - Date.now())).toBeLessThan(5000);
    const stopped = res.body.data.find((b: { code: string }) => b.code === "GZC-DONE");
    expect(stopped.clock.endedAt).not.toBeNull();
  });

  it("a session that was never started has no clock", async () => {
    await prisma.gzBooking.create({ data: { code: "GZC-LATER2", userId: REG, consoleId: "c-clock", gameTitle: "FIFA 26", date: todayKey(), startHour: 14, hours: 1, players: 1, total: 300, paymentMethod: "venue", paymentStatus: "pay_at_venue", status: "confirmed" } });
    const res = await api().get("/api/gamezone/bookings/me").set(bearer(tokenFor(REG)));
    expect(res.body.data.find((b: { code: string }) => b.code === "GZC-LATER2").clock).toBeNull();
    await prisma.gzBooking.delete({ where: { code: "GZC-LATER2" } });
  });

  it("keeps working when the admin's clock table does not exist yet", async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE "GzClock" RENAME TO "GzClock_off"`);
    try {
      const res = await api().get("/api/gamezone/bookings/me").set(bearer(tokenFor(REG)));
      expect(res.status).toBe(200);
      expect(res.body.data.every((b: { clock: unknown }) => b.clock === null)).toBe(true);
      expect(await sendGamezoneClockNotices()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "GzClock_off" RENAME TO "GzClock"`);
    }
  });
});

// keeps the unused guest phone from the other Gamezone test file out of this one
void GUEST;
