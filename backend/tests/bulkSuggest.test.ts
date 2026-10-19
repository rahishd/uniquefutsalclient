import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const U = "9800000931";
let saved: string | null = null;

const promos = (list: object[]) =>
  prisma.settings.upsert({ where: { key: "promoCodes" }, update: { value: JSON.stringify(list) }, create: { key: "promoCodes", value: JSON.stringify(list) } });
const base = { appliedTo: "booking", isActive: true };
const quote = (promoCode?: string) =>
  api().post("/api/bookings/bulk/quote").set(bearer(tokenFor(U)))
    .send({ slots: [16, 17, 18].map((h) => ({ date: futureDate(2), startTime: `${h}:00` })), promoCode });

async function wipe() {
  await prisma.clubMember.deleteMany({ where: { userId: U } }).catch(() => {});
  await prisma.booking.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
}
beforeAll(async () => {
  await wipe();
  await makeUser(U, "Bulk Suggest");
  saved = (await prisma.settings.findUnique({ where: { key: "promoCodes" } }))?.value ?? null;
});
afterAll(async () => {
  if (saved === null) await prisma.settings.deleteMany({ where: { key: "promoCodes" } });
  else await prisma.settings.update({ where: { key: "promoCodes" }, data: { value: saved } });
  await wipe();
});

describe("bulk booking: the best promo codes for the picked hours", () => {
  it("lists the codes that save the most, biggest saving first, with the best one marked", async () => {
    await promos([
      { ...base, code: "BIG25", type: "percent", value: 25, label: "25% off" },
      { ...base, code: "FLAT100", type: "flat", value: 100, label: "Rs. 100 off" },
      { ...base, code: "SMALL5", type: "percent", value: 5, label: "5% off" },
      { ...base, code: "TINY1", type: "percent", value: 1, label: "1% off" },
    ]);
    const r = await quote();
    expect(r.status).toBe(200);
    const s = r.body.data.suggestions as { code: string; discount: number; total: number; hours: number; best: boolean }[];
    expect(s).toHaveLength(3); // at most three
    expect(s[0].code).toBe("BIG25");
    expect(s.map((x) => x.best)).toEqual([true, false, false]);
    expect([...s].sort((a, b) => b.discount - a.discount).map((x) => x.code)).toEqual(s.map((x) => x.code));
    expect(s[0].hours).toBe(3);
    expect(s[0].total).toBe(r.body.data.subtotal - s[0].discount);
    // what is promised is what the quote gives when the code is applied
    const applied = (await quote("BIG25")).body.data;
    expect(applied.discount).toBe(s[0].discount);
    expect(applied.total).toBe(s[0].total);
  });

  it("leaves out inactive codes, membership-only codes and codes that cannot save anything", async () => {
    await promos([
      { ...base, code: "OFFNOW", type: "percent", value: 90, label: "off", isActive: false },
      { ...base, code: "MEMBERONLY", type: "percent", value: 90, label: "members", appliedTo: "membership" },
      { ...base, code: "ZERO", type: "flat", value: 0, label: "nothing" },
      { ...base, code: "REAL10", type: "percent", value: 10, label: "10% off" },
    ]);
    const s = (await quote()).body.data.suggestions as { code: string }[];
    expect(s.map((x) => x.code)).toEqual(["REAL10"]);
  });

  it("counts a once-per-customer code for one hour only, the way the booking will apply it", async () => {
    await promos([
      { ...base, code: "ONCE50", type: "percent", value: 50, label: "50% off", maxPerCustomer: 1 },
      { ...base, code: "ALL30", type: "percent", value: 30, label: "30% off" },
    ]);
    const s = (await quote()).body.data.suggestions as { code: string; hours: number; discount: number }[];
    const once = s.find((x) => x.code === "ONCE50")!;
    const all = s.find((x) => x.code === "ALL30")!;
    expect(once.hours).toBe(1);
    expect(all.hours).toBe(3);
    expect(once.discount).toBeLessThan(all.discount * 2); // one hour at 50% is not three hours at 50%
  });

  it("shows nothing when no code is set up", async () => {
    await promos([]);
    expect((await quote()).body.data.suggestions).toEqual([]);
  });
});
