import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { codeKey, createWithCode, ensurePaymentCode, ensurePaymentCodes } from "../src/modules/verify/verify.codes";
import { MAX_WRONG, maskName, resetAttempts } from "../src/modules/verify/verify.service";

const CUST = "9800000941";
const ALL = [CUST];

async function wipe() {
  await prisma.docVerification.deleteMany({ where: { OR: [{ issuedBy: "verify-test" }, { sourceId: { startsWith: "vt-" } }, { title: { startsWith: "VT " } }] } });
  await prisma.checkout.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.gzBooking.deleteMany({ where: { userId: { in: ALL } } });
  const ids = (await prisma.booking.findMany({ where: { userId: { in: ALL } }, select: { id: true } })).map((b) => b.id);
  await prisma.docVerification.deleteMany({ where: { sourceId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

const verify = (code: unknown) => api().post("/api/verify").send({ code });
let bookingId = "";
let checkoutId = "";

beforeAll(async () => {
  await wipe();
  await makeUser(CUST, "Rahish Kumar Dumre");
  const b = await prisma.booking.create({
    data: { userId: CUST, date: "2026-10-10", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "Rahish Kumar Dumre", customerPhone: CUST, basePrice: 1500, subtotal: 1500, totalPrice: 1500, paymentMethod: "venue", paymentStatus: "completed", status: "completed", cashAmount: 1500, code: "UF-VT0001" } as never,
  });
  bookingId = b.id;
  const c = await prisma.checkout.create({
    data: { code: "CB-VT0001", userId: CUST, paymentMethod: "cash", goodsTotal: 200, gameTotal: 1500, total: 1700, lines: JSON.stringify([{ type: "game", label: "Court 18:00", quantity: 1, amount: 1500 }, { type: "goods", label: "Water", quantity: 2, amount: 200 }]), createdBy: "verify-test" },
  });
  checkoutId = c.id;
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});
beforeEach(() => resetAttempts());

describe("verification codes", () => {
  it("are 4 digits, never repeat, and a paid record keeps its one code", async () => {
    const a = await ensurePaymentCode("booking", bookingId);
    expect(a).toMatch(/^[1-9]\d{3}$/);
    expect(await ensurePaymentCode("booking", bookingId)).toBe(a); // asked again: the same code
    const docs = await Promise.all(Array.from({ length: 12 }, (_, i) => createWithCode({ kind: "document", title: `VT ${i}`, issuedBy: "verify-test" })));
    const codes = new Set(docs.map((d) => d.code).concat(a));
    expect(codes.size).toBe(13);
  });

  it("many at once: one code each, and the existing one is kept", async () => {
    const first = await ensurePaymentCode("checkout", checkoutId);
    const m = await ensurePaymentCodes([{ sourceType: "checkout", sourceId: checkoutId }, { sourceType: "booking", sourceId: bookingId }]);
    expect(m.get(codeKey("checkout", checkoutId))).toBe(first);
    expect(m.get(codeKey("booking", bookingId))).toMatch(/^\d{4}$/);
  });

  it("shorten a name to first name and last initial", () => {
    expect(maskName("Rahish Kumar Dumre")).toBe("Rahish D.");
    expect(maskName("Sita")).toBe("Sita");
    expect(maskName(null)).toBe("Customer");
  });
});

describe("customer payment history", () => {
  it("gives every receipt a verification code, the same each time", async () => {
    const r1 = await api().get("/api/me/payments").set(bearer(tokenFor(CUST)));
    expect(r1.status).toBe(200);
    expect(r1.body.data.length).toBeGreaterThanOrEqual(2);
    for (const item of r1.body.data) expect(item.verifyCode).toMatch(/^\d{4,6}$/);
    const r2 = await api().get("/api/me/payments").set(bearer(tokenFor(CUST)));
    expect(r2.body.data.map((i: { verifyCode: string }) => i.verifyCode)).toEqual(r1.body.data.map((i: { verifyCode: string }) => i.verifyCode));
  });
});

describe("POST /api/verify (public)", () => {
  it("shows a genuine bill without the phone number and with a shortened name", async () => {
    const code = await ensurePaymentCode("checkout", checkoutId);
    const r = await verify(code); // no sign-in
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ genuine: true, kind: "payment", code, issuedBy: "Unique Futsal" });
    expect(r.body.data.bill).toMatchObject({ reference: "CB-VT0001", customer: "Rahish D.", total: 1700, status: "Paid", method: "Cash at the venue" });
    expect(r.body.data.bill.lines).toHaveLength(2);
    expect(JSON.stringify(r.body)).not.toContain(CUST);
  });

  it("shows a paid court booking with its payments", async () => {
    const code = await ensurePaymentCode("booking", bookingId);
    const r = await verify(code);
    expect(r.status).toBe(200);
    expect(r.body.data.bill).toMatchObject({ reference: "UF-VT0001", type: "game", total: 1500, payments: [{ method: "Cash at the venue", amount: 1500 }] });
  });

  it("refuses a code that was never issued: fake", async () => {
    await prisma.docVerification.deleteMany({ where: { code: "7001" } });
    const none = await verify("7001");
    expect(none.status).toBe(404);
    expect(none.body.message).toMatch(/may be fake/i);
  });

  it("refuses a badly formed code", async () => {
    expect((await verify("12")).status).toBe(400);
    expect((await verify("abcd")).status).toBe(400);
    expect((await verify(undefined)).status).toBe(400);
  });

  it("does not verify a payment that is not paid", async () => {
    const unpaid = await prisma.booking.create({
      data: { userId: CUST, date: "2026-10-11", startTime: "19:00", endTime: "20:00", duration: 1, customerPhone: CUST, basePrice: 1500, subtotal: 1500, totalPrice: 1500, paymentMethod: "venue", paymentStatus: "pending", status: "pending" } as never,
    });
    const code = await ensurePaymentCode("booking", unpaid.id);
    expect((await verify(code)).status).toBe(404);
  });

  it("shows a staff-made document with its text and photos, and stops when it is revoked", async () => {
    const media = await prisma.contentMedia.create({ data: { mime: "image/jpeg", data: Buffer.from("x"), width: 1, height: 1, bytes: 1, createdBy: "verify-test" } });
    const doc = await createWithCode({ kind: "document", title: "VT Partnership letter", issuedTo: "Everest Bank", orgType: "bank", details: "Monthly corporate booking.", mediaIds: [media.id], issuedBy: "verify-test" });
    const r = await verify(doc.code);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ kind: "document", document: { title: "VT Partnership letter", issuedTo: "Everest Bank", orgType: "bank", photos: [`/api/content/media/${media.id}`] } });
    await prisma.docVerification.update({ where: { id: doc.id }, data: { revokedAt: new Date() } });
    expect((await verify(doc.code)).status).toBe(404);
    await prisma.contentMedia.delete({ where: { id: media.id } });
  });

  it("stops a connection that keeps guessing wrong codes", async () => {
    await prisma.docVerification.deleteMany({ where: { code: { in: ["7002", "7003"] } } });
    for (let i = 0; i < MAX_WRONG; i++) expect((await verify("7002")).status).toBe(404);
    const blocked = await verify("7003");
    expect(blocked.status).toBe(429);
    // a genuine code is also held back for that connection until the hour is over
    const code = await ensurePaymentCode("booking", bookingId);
    expect((await verify(code)).status).toBe(429);
  });

  it("a correct code never uses up the allowance", async () => {
    const code = await ensurePaymentCode("booking", bookingId);
    for (let i = 0; i < MAX_WRONG + 3; i++) expect((await verify(code)).status).toBe(200);
  });
});
