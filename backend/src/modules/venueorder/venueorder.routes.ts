import { Router, Response } from "express";
import { body } from "express-validator";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import logger from "../../config/logger";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import authMiddleware, { AuthRequest } from "../../middlewares/auth.middleware";
import { todayKey } from "../../utils/dates";

// Ordering drinks and snacks at the venue (Mineral Water Bottle, Frooty, ...) from the app, while playing a booked game.
//  - Only a registered customer, and only the person who booked the game (the booking is found automatically, nobody picks it).
//  - Only while that game is on: from its start time to its end time (a game that runs past midnight counts).
//  - Only products staff switched on for the app ("Show in the customer Order list" in the admin Inventory page).
//  - The goods are put on the customer's account as a pay-later due (GoodsDue), exactly like goods staff give on credit, so the
//    admin sees it in Payments and the final bill, and the stock goes down now. Staff are alerted in the admin bell.
export const venueOrderRouter = Router();

const NEPAL = "+05:45";
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00${NEPAL}`);
const addDay = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const MAX_PER_ITEM = 6;
export const MAX_UNITS_PER_ORDER = 10;
export const MAX_ORDERS_PER_GAME = 5;

type Game = { id: string; date: string; startTime: string; endTime: string };

// [start, end] of a game in ms; an end at or before the start means it runs past midnight
function span(g: Game): [number, number] {
  const s = at(g.date, g.startTime);
  let e = at(g.date, g.endTime);
  if (e <= s) e += 86_400_000;
  return [s, e];
}

// The customer's game that is on right now (they booked it), and the next one still to come.
export async function currentGame(userId: string, now = new Date()): Promise<{ active: Game | null; next: Game | null }> {
  const t = now.getTime();
  const today = todayKey(now);
  const days = [addDay(today, -1), today, addDay(today, 1)];
  const games = await prisma.booking.findMany({
    where: { OR: [{ userId }, { customerPhone: userId }], date: { in: days }, status: "confirmed" },
    select: { id: true, date: true, startTime: true, endTime: true, userId: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  // "the one who booked": the booking belongs to this account
  const mine = games.filter((g) => g.userId === userId);
  const active = mine.find((g) => { const [s, e] = span(g); return t >= s && t < e; }) ?? null;
  const next = mine.find((g) => span(g)[0] > t) ?? null;
  return { active, next };
}

const view = (g: Game | null) => (g ? { id: g.id, date: g.date, startTime: g.startTime, endTime: g.endTime } : null);

const customerOnly = (req: AuthRequest) => {
  if (req.user!.role !== "user") throw new AppError(403, "Ordering at the venue is for registered customers");
};

// What can be ordered right now: the game that is on, and the products staff made orderable.
venueOrderRouter.get(
  "/current",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    customerOnly(req);
    const { active, next } = await currentGame(req.user!.id);
    const items = active
      ? await prisma.product.findMany({ where: { orderable: true, inventory: { gt: 0 } }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true, unit: true, inventory: true } })
      : [];
    res.json(
      ApiResponseUtil.success(200, "OK", {
        active: view(active),
        next: view(next),
        limits: { perItem: MAX_PER_ITEM, perOrder: MAX_UNITS_PER_ORDER },
        items: items.map((p) => ({ id: p.id, name: p.name, price: p.price, unit: p.unit, left: Math.min(p.inventory, MAX_PER_ITEM) })),
      }),
    );
  }),
);

venueOrderRouter.post(
  "/",
  authMiddleware,
  [
    body("items").isArray({ min: 1, max: 12 }).withMessage("Choose what you want to order"),
    body("items.*.productId").isString().notEmpty(),
    body("items.*.quantity").isInt({ min: 1, max: MAX_PER_ITEM }).withMessage(`You can order up to ${MAX_PER_ITEM} of each item`),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    customerOnly(req);
    const userId = req.user!.id;
    const { active } = await currentGame(userId);
    if (!active) throw new AppError(403, "You can order while your booked game is on. Ordering opens at your game start time.");

    // same product twice becomes one line
    const merged = new Map<string, number>();
    for (const it of req.body.items as { productId: string; quantity: number }[]) merged.set(it.productId, (merged.get(it.productId) ?? 0) + Number(it.quantity));
    const units = [...merged.values()].reduce((a, b) => a + b, 0);
    if ([...merged.values()].some((q) => q > MAX_PER_ITEM)) throw new AppError(400, `You can order up to ${MAX_PER_ITEM} of each item`);
    if (units > MAX_UNITS_PER_ORDER) throw new AppError(400, `One order can have up to ${MAX_UNITS_PER_ORDER} items. Place another order after this one is served.`);

    const me = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true, isActive: true } });
    if (!me?.isActive) throw new AppError(403, "This account cannot order right now");

    const result = await prisma.$transaction(async (tx) => {
      const already = await tx.goodsSale.count({ where: { bookingId: active.id, soldBy: `app:${userId}` } });
      if (already >= MAX_ORDERS_PER_GAME) throw new AppError(429, "You have reached the order limit for this game. Please ask at the counter.");

      const ids = [...merged.keys()];
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      if (products.length !== ids.length || products.some((p) => !p.orderable)) throw new AppError(404, "One of those items is not available to order");
      const lines = products.map((p) => {
        const qty = merged.get(p.id)!;
        if (p.inventory < qty) throw new AppError(409, p.inventory > 0 ? `Only ${p.inventory} ${p.name} left` : `${p.name} is out of stock`);
        return { p, qty, amount: Math.round(p.price * qty) };
      });
      const total = lines.reduce((s, l) => s + l.amount, 0);
      const itemsText = lines.map((l) => `${l.qty} x ${l.p.name}`).join(", ").slice(0, 190);
      const sale = await tx.goodsSale.create({
        data: { userId, phone: userId, amount: total, items: itemsText, soldBy: `app:${userId}`, customerName: me.name ?? null, bookingId: active.id },
      });
      for (const l of lines) {
        await tx.product.update({ where: { id: l.p.id }, data: { inventory: { decrement: l.qty } } });
        await tx.inventoryLog.create({ data: { productId: l.p.id, change: -l.qty, price: l.p.price, reason: `Goods Sale #${sale.id}`, cashAmount: 0, onlineAmount: 0 } });
      }
      const due = await tx.goodsDue.create({
        data: {
          userId, saleId: sale.id, amount: total, items: itemsText,
          lines: JSON.stringify(lines.map((l) => ({ type: "goods", label: l.p.name, quantity: l.qty, amount: l.amount }))),
          createdBy: `app:${userId}`,
        },
      });
      return { dueId: due.id, total, items: itemsText };
    });

    logger.info(`Venue order by ${userId.slice(0, 3)}*******: ${result.items} (Rs. ${result.total})`);
    res.status(201).json(ApiResponseUtil.success(201, "Order sent. Staff will bring it to you.", { id: result.dueId, items: result.items, total: result.total, game: view(active) }));
  }),
);

export default venueOrderRouter;
