import { api, adminToken, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { currentTime, todayKey } from "../src/utils/dates";

const U = "9800000251"; // booked the game that is on
const V = "9800000252"; // has no game
const W = "9800000253"; // a game is on, booked by someone else for them
const X = "9800000254"; // booked a game on behalf of W
const ALL = [U, V, W, X];

const minutes = (n: number) => currentTime(new Date(Date.now() + n * 60_000));
let catId = "";
let water = "";
let frooty = "";
let hidden = "";
let gameId = "";

const get = (who: string) => api().get("/api/venue-orders/current").set(bearer(tokenFor(who)));
const order = (items: { productId: string; quantity: number }[], who = U) => api().post("/api/venue-orders").set(bearer(tokenFor(who))).send({ items });
const stock = async (id: string) => (await prisma.product.findUnique({ where: { id } }))!.inventory;

async function wipe() {
  const sales = await prisma.goodsSale.findMany({ where: { userId: { in: ALL } }, select: { id: true } });
  await prisma.goodsDue.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.goodsSale.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.inventoryLog.deleteMany({ where: { reason: { in: sales.map((s) => `Goods Sale #${s.id}`) } } });
  await prisma.booking.deleteMany({ where: { OR: [{ userId: { in: ALL } }, { customerPhone: { in: ALL } }] } });
  await prisma.product.deleteMany({ where: { name: { startsWith: "VOTEST " } } });
  await prisma.category.deleteMany({ where: { name: "VOTEST cat" } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

const booking = (userId: string, start: string, end: string, extra: Record<string, unknown> = {}) =>
  prisma.booking.create({
    data: {
      userId, date: todayKey(), startTime: start, endTime: end, duration: 1, customerName: "VO", customerPhone: userId,
      basePrice: 1250, subtotal: 1250, totalPrice: 1250, paymentMethod: "venue", paymentStatus: "pending", status: "confirmed", ...extra,
    } as any,
  });

beforeAll(async () => {
  await wipe();
  for (const [p, n] of [[U, "Order Booker"], [V, "No Game"], [W, "Guest Of Booker"], [X, "Other Booker"]] as const) await makeUser(p, n);
  const cat = await prisma.category.create({ data: { name: "VOTEST cat", slug: "votest-cat" } });
  catId = cat.id;
  water = (await prisma.product.create({ data: { name: "VOTEST Mineral Water Bottle", price: 40, categoryId: catId, inventory: 20, orderable: true } })).id;
  frooty = (await prisma.product.create({ data: { name: "VOTEST Frooty", price: 35, categoryId: catId, inventory: 2, orderable: true } })).id;
  hidden = (await prisma.product.create({ data: { name: "VOTEST Energy Drink", price: 150, categoryId: catId, inventory: 10, orderable: false } })).id;
  gameId = (await booking(U, minutes(-10), minutes(50))).id; // U's game is on now
  await booking(V, minutes(120), minutes(180)); // V's game is later
  await booking(U, minutes(-10), minutes(50), { userId: X, customerPhone: W }); // W is only the contact; someone else booked it
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("ordering at the venue during your game", () => {
  it("shows the orderable items to the person who booked the game that is on", async () => {
    const r = await get(U);
    expect(r.status).toBe(200);
    expect(r.body.data.active).toMatchObject({ id: gameId });
    const names = r.body.data.items.map((i: { name: string }) => i.name);
    expect(names).toContain("VOTEST Mineral Water Bottle");
    expect(names).toContain("VOTEST Frooty");
    expect(names).not.toContain("VOTEST Energy Drink"); // staff did not switch it on
  });

  it("is closed outside the game time, and for anyone who did not book the game", async () => {
    const early = await get(V);
    expect(early.body.data.active).toBeNull();
    expect(early.body.data.next).not.toBeNull();
    expect(early.body.data.items).toEqual([]);
    expect((await order([{ productId: water, quantity: 1 }], V)).status).toBe(403);
    expect((await order([{ productId: water, quantity: 1 }], W)).status).toBe(403); // not the account that booked it
    expect((await api().post("/api/venue-orders").send({ items: [{ productId: water, quantity: 1 }] })).status).toBe(401);
    expect((await api().post("/api/venue-orders").set(bearer(adminToken())).send({ items: [{ productId: water, quantity: 1 }] })).status).toBe(403);
  });

  it("puts the order on the customer's account as a pay-later due, takes the stock and tells staff", async () => {
    const res = await order([{ productId: water, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ items: "1 x VOTEST Mineral Water Bottle", total: 40 });
    expect(await stock(water)).toBe(19);

    const due = await prisma.goodsDue.findFirst({ where: { userId: U, status: "due" } });
    expect(due).toMatchObject({ amount: 40, createdBy: `app:${U}`, items: "1 x VOTEST Mineral Water Bottle" });
    const sale = await prisma.goodsSale.findUnique({ where: { id: due!.saleId } });
    expect(sale).toMatchObject({ bookingId: gameId, soldBy: `app:${U}`, userId: U });
    expect(JSON.parse(due!.lines)).toEqual([{ type: "goods", label: "VOTEST Mineral Water Bottle", quantity: 1, amount: 40 }]);
  });

  it("refuses items staff did not switch on, more than is in stock, and too many at once", async () => {
    expect((await order([{ productId: hidden, quantity: 1 }])).status).toBe(404);
    expect((await order([{ productId: frooty, quantity: 3 }])).status).toBe(409); // only 2 in stock
    expect(await stock(frooty)).toBe(2); // nothing was taken
    expect((await order([{ productId: water, quantity: 7 }])).status).toBe(400); // 6 of one item at most
    expect((await order([{ productId: water, quantity: 6 }, { productId: frooty, quantity: 2 }, { productId: water, quantity: 2 }])).status).toBe(400); // 10 items at most
    expect((await order([])).status).toBe(400);
  });

  it("limits how many orders one game can place", async () => {
    // one order is already in; four more are allowed, the next is refused
    for (let i = 0; i < 4; i++) expect((await order([{ productId: water, quantity: 1 }])).status).toBe(201);
    expect((await order([{ productId: water, quantity: 1 }])).status).toBe(429);
  });
});
