import fs from "fs";
import path from "path";
import sharp from "sharp";
import { api, adminToken, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { todayKey, addDaysKey } from "../src/utils/dates";

const A = "9800000801"; // files claims
const P = "9800000802"; // the injured player, with an emergency contact
const N = "9800000803"; // registered, no emergency contact
const SIGNUP = "9800000804";
const UNREGISTERED = "9800000899";
const EM = "9811110802";
const files: string[] = [];

// The witness name in Nepali needs a UTF-8 database. A local Postgres created as WIN1252 cannot store Devanagari at all,
// so the tests that save a claim only run on a UTF-8 database (production; recreate the local one with ENCODING 'UTF8').
let utf8 = true;
const itUtf8 = (name: string, fn: () => Promise<void>) => it(name, async () => {
  if (!utf8) { console.warn(`skipped on a non-UTF-8 test database: ${name}`); return; }
  await fn();
});

const png = async () => `data:image/png;base64,${(await sharp({ create: { width: 40, height: 30, channels: 3, background: "#22aa44" } }).png().toBuffer()).toString("base64")}`;
const good = async () => ({
  patientName: "Injured Ina", patientPhone: P, witnessName: "Ram Thapa", witnessNameNe: "राम थापा", witnessPhone: "9811112222",
  severity: "minor", incidentDate: todayKey(), description: "Twisted ankle in the second half.", photos: [await png()],
});
const send = (phone: string, body: object) => api().post("/api/insurance").set(bearer(tokenFor(phone))).send(body);

async function wipe() {
  const phones = [A, P, N, SIGNUP];
  for (const c of await prisma.insuranceClaim.findMany({ where: { userId: { in: phones } } })) {
    for (const p of c.photos) if (p.startsWith("/uploads/")) fs.rmSync(path.join(process.cwd(), p), { force: true });
  }
  await prisma.insuranceClaim.deleteMany({ where: { userId: { in: phones } } });
  await prisma.emergencyCall.deleteMany({ where: { callerId: { in: phones } } });
  await prisma.notification.deleteMany({ where: { userId: { in: phones } } });
  await prisma.pendingSignup.deleteMany({ where: { phoneNumber: SIGNUP } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: phones } } });
}

beforeAll(async () => {
  const [{ enc }] = await prisma.$queryRawUnsafe<{ enc: string }[]>("select pg_encoding_to_char(encoding) as enc from pg_database where datname = current_database()");
  utf8 = enc === "UTF8";
  await wipe();
  await makeUser(A, "Filer A");
  await makeUser(P, "Injured Ina", { emergencyName: "Mother Maya", emergencyPhone: EM, emergencyRelation: "Mother" });
  await makeUser(N, "No Contact Nabin");
});
afterAll(async () => {
  for (const f of files) fs.rmSync(f, { force: true });
  await wipe();
});

describe("insurance claims: filing", () => {
  it("lists the options without signing in", async () => {
    const r = await api().get("/api/insurance/options");
    expect(r.status).toBe(200);
    expect(r.body.data.severities).toEqual(["minor", "emergency"]);
    expect(r.body.data.ambulance).toBe("102");
  });

  it("needs a signed-in customer", async () => {
    expect((await api().post("/api/insurance").send(await good())).status).toBe(401);
    expect((await api().get("/api/insurance/me")).status).toBe(401);
  });

  it("checks every field", async () => {
    const g = await good();
    expect((await send(A, { ...g, patientName: "" })).status).toBe(400);
    expect((await send(A, { ...g, patientPhone: UNREGISTERED })).status).toBe(400); // must be a registered account
    expect((await send(A, { ...g, witnessNameNe: "Ram Thapa" })).status).toBe(400); // must be written in Nepali
    expect((await send(A, { ...g, severity: "serious" })).status).toBe(400);
    expect((await send(A, { ...g, incidentDate: addDaysKey(todayKey(), 1) })).status).toBe(400);
    expect((await send(A, { ...g, incidentDate: addDaysKey(todayKey(), -31) })).status).toBe(400);
    expect((await send(A, { ...g, photos: [] })).status).toBe(400); // a photo is required
    expect((await send(A, { ...g, photos: ["data:text/plain;base64,aGVsbG8="] })).status).toBe(400);
    expect(await prisma.insuranceClaim.count({ where: { userId: A } })).toBe(0);
  });

  itUtf8("saves a claim, stores the photo, and tells the injured player", async () => {
    const r = await send(A, await good());
    expect(r.status).toBe(201);
    expect(r.body.data.code).toMatch(/^IC-[A-Z2-9]{6}$/);
    expect(r.body.data.status).toBe("submitted");
    expect(r.body.data.photos).toHaveLength(1);
    const p = r.body.data.photos[0] as string;
    if (p.startsWith("/uploads/")) { expect(p).toMatch(/^\/uploads\/insurance\//); files.push(path.join(process.cwd(), p)); }
    const notice = await prisma.notification.findFirst({ where: { userId: P, type: "insurance" } });
    expect(notice?.message).toContain(r.body.data.code);
    // both the filer and the patient see it
    const mineA = await api().get("/api/insurance/me").set(bearer(tokenFor(A)));
    const mineP = await api().get("/api/insurance/me").set(bearer(tokenFor(P)));
    expect(mineA.body.data[0].filedByMe).toBe(true);
    expect(mineP.body.data[0].filedByMe).toBe(false);
    expect((await api().get("/api/insurance/me").set(bearer(tokenFor(N)))).body.data).toHaveLength(0);
  });

  itUtf8("limits claims per day", async () => {
    await send(A, await good());
    await send(A, await good());
    expect((await send(A, await good())).status).toBe(429);
  });
});

describe("insurance claims: slide to call the emergency contact", () => {
  const look = (caller: string, patientPhone: string) => api().post("/api/insurance/emergency-contact").set(bearer(tokenFor(caller))).send({ patientPhone });

  it("returns the injured player's emergency contact and logs the lookup", async () => {
    const r = await look(A, P);
    expect(r.status).toBe(200);
    expect(r.body.data.contact.phone).toBe(EM);
    expect(r.body.data.contact.masked).toBe("98•••••802");
    expect(r.body.data.contact.relation).toBe("Mother");
    expect(await prisma.emergencyCall.count({ where: { callerId: A, patientPhone: P, found: true } })).toBe(1);
  });

  it("says when no contact is saved, and refuses unknown numbers and guests", async () => {
    const r = await look(A, N);
    expect(r.status).toBe(200);
    expect(r.body.data.contact).toBeNull();
    expect(r.body.data.ambulance).toBe("102");
    expect((await look(A, UNREGISTERED)).status).toBe(404);
    expect((await api().post("/api/insurance/emergency-contact").send({ patientPhone: P })).status).toBe(401);
  });

  it("limits lookups per day", async () => {
    await prisma.emergencyCall.createMany({ data: Array.from({ length: 10 }, () => ({ callerId: N, patientPhone: P, found: true })) });
    expect((await look(N, P)).status).toBe(429);
  });
});

describe("insurance claims: staff", () => {
  itUtf8("only staff can list and update, and the customer is told", async () => {
    expect((await api().get("/api/insurance/admin").set(bearer(tokenFor(A)))).status).toBe(403);
    const list = await api().get("/api/insurance/admin?status=submitted").set(bearer(adminToken()));
    expect(list.status).toBe(200);
    const claim = list.body.data.items.find((c: { userId: string }) => c.userId === A);
    expect(claim).toBeTruthy();
    const upd = await api().patch(`/api/insurance/admin/${claim.id}`).set(bearer(adminToken())).send({ status: "approved", reply: "Approved. Bring the hospital bill to the desk." });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe("approved");
    expect(upd.body.data.decidedAt).toBeTruthy();
    expect(await prisma.notification.count({ where: { userId: A, type: "insurance" } })).toBeGreaterThan(0);
    expect((await api().patch(`/api/insurance/admin/${claim.id}`).set(bearer(adminToken())).send({ status: "paid" })).status).toBe(400);
  });
});

describe("emergency contact on the account", () => {
  const base = { name: "Signing Sita", phoneNumber: SIGNUP, password: "secret1", dateOfBirth: "2000-05-05" };

  it("is required at sign-up and cannot be the customer's own number", async () => {
    expect((await api().post("/api/auth/signup").send(base)).status).toBe(400);
    expect((await api().post("/api/auth/signup").send({ ...base, emergencyName: "Me", emergencyPhone: SIGNUP })).status).toBe(400);
    expect((await api().post("/api/auth/signup").send({ ...base, emergencyName: "Sister", emergencyPhone: "12345" })).status).toBe(400);
    const ok = await api().post("/api/auth/signup").send({ ...base, emergencyName: "Sister Sabina", emergencyPhone: "9811113333", emergencyRelation: "Sister" });
    expect(ok.status).toBe(201);
    const u = await prisma.user.findUnique({ where: { phoneNumber: SIGNUP } });
    expect(u?.emergencyPhone).toBe("9811113333");
    expect(u?.emergencyRelation).toBe("Sister");
  });

  it("/auth/me says whether one is saved, and the profile can add or replace it", async () => {
    expect((await api().get("/api/auth/me").set(bearer(tokenFor(N)))).body.data.hasEmergencyContact).toBe(false);
    const patch = (body: object) => api().patch("/api/me/profile").set(bearer(tokenFor(N))).send(body);
    expect((await patch({ emergencyName: "Brother", emergencyPhone: N })).status).toBe(400);
    expect((await patch({ emergencyName: "Brother Bikash", emergencyPhone: "9811114444" })).status).toBe(200);
    expect((await api().get("/api/auth/me").set(bearer(tokenFor(N)))).body.data.hasEmergencyContact).toBe(true);
    const prof = await api().get("/api/me/profile").set(bearer(tokenFor(N)));
    expect(prof.body.data.emergencyPhone).toBe("9811114444");
  });
});
