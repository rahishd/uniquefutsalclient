import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { amountFor, tokenFromScan } from "../src/modules/ev/ev.service";

const A = "9800000821";
const B = "9800000822";
const ALL = [A, B];

const get = (phone: string, url: string) => api().get(url).set(bearer(tokenFor(phone)));
const post = (phone: string, url: string, body: object = {}) => api().post(url).set(bearer(tokenFor(phone))).send(body);

let portId = "";
let token = "";

async function wipe() {
  await prisma.evCharge.deleteMany({ where: { OR: [{ userId: { in: ALL } }, { portId: portId || "none" }] } });
  await prisma.evPort.deleteMany({ where: { name: "Test Port" } });
  await prisma.notification.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: ALL } } });
}

beforeAll(async () => {
  await prisma.evCharge.deleteMany({ where: { userId: { in: ALL } } });
  await prisma.evPort.deleteMany({ where: { name: "Test Port" } });
  await makeUser(A, "Ev A");
  await makeUser(B, "Ev B");
  const p = await prisma.evPort.create({ data: { name: "Test Port", qrToken: "TESTTOKEN123" } });
  portId = p.id;
  token = p.qrToken;
});
afterAll(wipe);

describe("ev charging billing", () => {
  it("bills by started quarter hours at the hourly rate", () => {
    expect(amountFor(1, 50)).toBe(13);
    expect(amountFor(15, 50)).toBe(13);
    expect(amountFor(16, 50)).toBe(25);
    expect(amountFor(60, 50)).toBe(50);
    expect(amountFor(61, 50)).toBe(63);
  });

  it("reads the port token from a link, the plain code, or a bare token", () => {
    expect(tokenFromScan("https://app.example.com/ev?port=ABC123")).toBe("ABC123");
    expect(tokenFromScan("UFEV1.ABC123")).toBe("ABC123");
    expect(tokenFromScan("ABC123")).toBe("ABC123");
  });
});

describe("ev charging sessions", () => {
  let session = "";

  it("needs a signed-in customer", async () => {
    expect((await api().get("/api/ev/me")).status).toBe(401);
    expect((await api().post("/api/ev/start").send({ code: token })).status).toBe(401);
  });

  it("refuses an unknown port", async () => {
    expect((await post(A, "/api/ev/start", { code: "NOSUCHPORT" })).status).toBe(404);
  });

  it("starts charging from the scanned QR, and a port or person can only have one session", async () => {
    const r = await post(A, "/api/ev/start", { code: `https://x.test/ev?port=${token}` });
    expect(r.status).toBe(201);
    session = r.body.data.id;
    expect(r.body.data.status).toBe("charging");
    expect((await post(B, "/api/ev/start", { code: token })).status).toBe(409);
    expect((await post(A, "/api/ev/start", { code: token })).status).toBe(409);
    const me = (await get(A, "/api/ev/me")).body.data;
    expect(me.active.id).toBe(session);
    expect(me.rate).toBe(50);
  });

  it("only the owner can stop it; stopping makes an unpaid bill", async () => {
    expect((await post(B, `/api/ev/${session}/stop`)).status).toBe(404);
    const r = await post(A, `/api/ev/${session}/stop`);
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("unpaid");
    expect(r.body.data.amount).toBe(13);
    expect((await post(A, `/api/ev/${session}/stop`)).status).toBe(409);
    const me = (await get(A, "/api/ev/me")).body.data;
    expect(me.active).toBeNull();
    expect(me.owed).toBe(13);
    expect(me.history).toHaveLength(1);
  });

  it("frees the port for the next customer", async () => {
    expect((await post(B, "/api/ev/start", { code: token })).status).toBe(201);
  });
});

describe("ev charging controller (webhook)", () => {
  const C = "9800000823";
  const calls: { action: string; sig: string | undefined; body: string }[] = [];
  let server: import("http").Server;
  let url = "";
  let fail = false;
  let webToken = "";

  beforeAll(async () => {
    const http = await import("http");
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        calls.push({ action: JSON.parse(body).action, sig: req.headers["x-uf-signature"] as string | undefined, body });
        res.statusCode = fail ? 500 : 200;
        res.end("{}");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as import("net").AddressInfo).port}/plug`;
    await makeUser(C, "Ev C");
    const p = await prisma.evPort.create({ data: { name: "Test Port", qrToken: "WEBHOOKTOKEN1", provider: "webhook", providerConfig: JSON.stringify({ url, secret: "s3cret", deviceId: "dev-1" }) } });
    webToken = p.qrToken;
  });
  afterAll(async () => {
    await prisma.evCharge.deleteMany({ where: { userId: C } });
    await prisma.evPort.deleteMany({ where: { qrToken: "WEBHOOKTOKEN1" } });
    await prisma.notification.deleteMany({ where: { userId: C } });
    await prisma.user.deleteMany({ where: { phoneNumber: C } });
    await new Promise((r) => server.close(r));
  });

  it("switches the plug on when charging starts and off when it stops, with a signed call", async () => {
    const start = await post(C, "/api/ev/start", { code: webToken });
    expect(start.status).toBe(201);
    expect(calls[0].action).toBe("on");
    const { createHmac } = await import("crypto");
    expect(calls[0].sig).toBe(createHmac("sha256", "s3cret").update(calls[0].body).digest("hex"));
    expect(JSON.parse(calls[0].body).port.deviceId).toBe("dev-1");
    const stop = await post(C, `/api/ev/${start.body.data.id}/stop`);
    expect(stop.status).toBe(200);
    expect(calls[1].action).toBe("off");
    expect(stop.body.data.warning).toBeNull();
  });

  it("cancels the session when the plug will not switch on, so nothing is billed", async () => {
    fail = true;
    const r = await post(C, "/api/ev/start", { code: webToken });
    expect(r.status).toBe(502);
    const me = (await get(C, "/api/ev/me")).body.data;
    expect(me.active).toBeNull();
    fail = false;
  });

  it("still bills when the plug will not switch off, and warns", async () => {
    const start = await post(C, "/api/ev/start", { code: webToken });
    expect(start.status).toBe(201);
    fail = true;
    const stop = await post(C, `/api/ev/${start.body.data.id}/stop`);
    expect(stop.status).toBe(200);
    expect(stop.body.data.status).toBe("unpaid");
    expect(stop.body.data.warning).toMatch(/staff/);
    fail = false;
  });
});
