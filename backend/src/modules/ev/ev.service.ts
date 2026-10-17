import { EvCharge, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import logger from "../../config/logger";
import { controllerFor } from "./ev.provider";

// EV charging at the venue (paid AC charging, Rs. 50 an hour unless Settings "evChargeRate" says otherwise). The customer scans
// the QR at a charging port to start, stops when done, and the bill is paid at the venue (staff mark it paid in the admin portal).
// Billing is by started quarter hours so a short top up is not charged a whole hour. The server decides everything, never the app.
export const DEFAULT_RATE = 50;
export const BLOCK_MINUTES = 15;

export async function getRate(): Promise<number> {
  const v = (await prisma.settings.findUnique({ where: { key: "evChargeRate" } }))?.value;
  return Math.max(1, Math.round(Number(v ?? DEFAULT_RATE)) || DEFAULT_RATE);
}

export const minutesBetween = (start: Date, end: Date) => Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 60000));
export const amountFor = (minutes: number, rate: number) => Math.ceil(Math.ceil(minutes / BLOCK_MINUTES) * rate / (60 / BLOCK_MINUTES));

// the code printed in the QR: a link (the phone camera opens the app page) or just the token
export function tokenFromScan(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  const m = s.match(/[?&]port=([A-Za-z0-9]+)/) ?? s.match(/^UFEV1\.([A-Za-z0-9]+)$/);
  return (m ? m[1] : s).slice(0, 64);
}

const view = (r: EvCharge, portName: string | null) => ({
  id: r.id, status: r.status, port: portName, startedAt: r.startedAt, endedAt: r.endedAt, minutes: r.minutes, rate: r.rate, amount: r.amount, paidAt: r.paidAt, source: r.source,
});

export class EvService {
  async me(userId: string) {
    const [rate, rows, ports] = await Promise.all([
      getRate(),
      prisma.evCharge.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.evPort.findMany({ select: { id: true, name: true } }),
    ]);
    const names = new Map(ports.map((p) => [p.id, p.name]));
    const items = rows.map((r) => view(r, r.portId ? names.get(r.portId) ?? null : null));
    const active = items.find((i) => i.status === "charging") ?? null;
    return {
      rate, blockMinutes: BLOCK_MINUTES, active, history: items.filter((i) => i.status !== "charging"),
      owed: rows.filter((r) => r.status === "unpaid").reduce((s, r) => s + r.amount, 0),
    };
  }

  async start(userId: string, scan: unknown) {
    const token = tokenFromScan(scan);
    if (!token) throw new AppError(400, "Scan the QR code at the charging port.");
    const port = await prisma.evPort.findUnique({ where: { qrToken: token } });
    if (!port || !port.isActive) throw new AppError(404, "This charging port is not available.");
    if (await prisma.evCharge.findFirst({ where: { userId, status: "charging" }, select: { id: true } })) throw new AppError(409, "You are already charging. Stop that session first.");
    if (await prisma.evCharge.findFirst({ where: { portId: port.id, status: "charging" }, select: { id: true } })) throw new AppError(409, `${port.name} is in use right now.`);
    const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true } });
    const rate = await getRate();
    try {
      const row = await prisma.evCharge.create({
        data: { portId: port.id, userId, phone: userId, customerName: user?.name ?? null, rate, amount: 0, status: "charging", source: "app", startedAt: new Date(), createdBy: userId },
      });
      // switch the plug on; if that fails the session is cancelled so the customer is never billed for charging that did not happen
      try {
        await controllerFor(port).switch(port, "on", { sessionId: row.id, customerName: row.customerName });
      } catch (err) {
        logger.error(`EV port ${port.name}: could not switch on`, err);
        await prisma.evCharge.updateMany({ where: { id: row.id, status: "charging" }, data: { status: "cancelled", endedAt: new Date() } });
        throw new AppError(502, "The charger did not switch on. Please ask the staff for help.");
      }
      return view(row, port.name);
    } catch (e) {
      if (e instanceof AppError) throw e;
      // two people scanning at the same moment: the database lets only one charging session per port and per person
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError(409, `${port.name} is in use right now.`);
      throw e;
    }
  }

  async stop(userId: string, id: string) {
    const row = await prisma.evCharge.findUnique({ where: { id } });
    // not yours and "no such session" look the same
    if (!row || row.userId !== userId) throw new AppError(404, "Charging session not found.");
    if (row.status !== "charging") throw new AppError(409, "This session is already finished.");
    const end = new Date();
    const minutes = minutesBetween(row.startedAt ?? row.createdAt, end);
    const done = await prisma.evCharge.updateMany({
      where: { id, status: "charging" },
      data: { status: "unpaid", endedAt: end, minutes, hours: Math.ceil(minutes / 60), amount: amountFor(minutes, row.rate) },
    });
    if (done.count !== 1) throw new AppError(409, "This session is already finished.");
    const fresh = await prisma.evCharge.findUniqueOrThrow({ where: { id } });
    const port = fresh.portId ? await prisma.evPort.findUnique({ where: { id: fresh.portId } }) : null;
    // the bill is made first; a plug that will not switch off is reported to the customer, and staff can switch it off by hand
    let warning: string | null = null;
    if (port) {
      try {
        await controllerFor(port).switch(port, "off", { sessionId: fresh.id, customerName: fresh.customerName });
      } catch (err) {
        logger.error(`EV port ${port.name}: could not switch off`, err);
        warning = "The charger may still be on. Please tell the staff.";
      }
    }
    return { ...view(fresh, port?.name ?? null), warning };
  }
}

export default new EvService();
