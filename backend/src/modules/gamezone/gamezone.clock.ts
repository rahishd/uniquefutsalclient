import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import logger from "../../config/logger";

// The live clock of a Gamezone session. Staff press Start in the admin portal, which writes a row in the admin-owned "GzClock" table of the
// shared database; this app only reads it, so the customer sees the same countdown, extra time and extra price as the staff. It is read with a
// plain query (not a Prisma model) so this app keeps working before the admin's migration has created the table: no table means no clock.
export interface GzClockRow {
  bookingCode: string;
  startedAt: Date;
  endedAt: Date | null;
  bookedMinutes: number;
  hourlyRate: number; // Rs per hour for the whole session; extra minutes are billed at hourlyRate / 60
  extraMinutes: number; // set when the session is stopped
  extraCharge: number;
}

const COLUMNS = Prisma.sql`"bookingCode", "startedAt", "endedAt", "bookedMinutes", "hourlyRate", "extraMinutes", "extraCharge"`;

async function read(query: Prisma.Sql): Promise<GzClockRow[]> {
  try {
    return await prisma.$queryRaw<GzClockRow[]>(query);
  } catch (err) {
    if ((err as { meta?: { code?: string } }).meta?.code !== "42P01") logger.error("Could not read Gamezone clocks", err); // 42P01: the table does not exist yet
    return [];
  }
}

export async function loadClocks(codes: string[]): Promise<Map<string, GzClockRow>> {
  if (codes.length === 0) return new Map();
  const rows = await read(Prisma.sql`SELECT ${COLUMNS} FROM "GzClock" WHERE "bookingCode" IN (${Prisma.join(codes)})`);
  return new Map(rows.map((r) => [r.bookingCode, r]));
}

// Sessions whose clock is running right now
export const runningClocks = () => read(Prisma.sql`SELECT ${COLUMNS} FROM "GzClock" WHERE "endedAt" IS NULL`);

// What the app shows. `now` is the server's time, so the countdown is right even if the phone's clock is off.
export const clockView = (c: GzClockRow, now: Date = new Date()) => ({
  startedAt: c.startedAt, endedAt: c.endedAt, bookedMinutes: c.bookedMinutes, hourlyRate: c.hourlyRate, extraMinutes: c.extraMinutes, extraCharge: c.extraCharge, now,
});

export const perMinute = (hourlyRate: number): string => String(Math.round((hourlyRate / 60) * 10) / 10);
