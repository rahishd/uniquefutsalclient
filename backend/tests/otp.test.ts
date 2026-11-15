import { api, makeUser, prisma } from "./helpers";
import smsService from "../src/services/sms.service";

const OLD = "9800000981"; // has an account
const NEW = "9800000982"; // new customer
let lastText = "";
const codeOf = () => lastText.slice(0, 6);

beforeAll(async () => {
  await prisma.loginOtp.deleteMany({ where: { phoneNumber: { in: [OLD, NEW] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [OLD, NEW] } } });
  await makeUser(OLD, "Otp Old");
  jest.spyOn(smsService, "send").mockImplementation(async (o) => { lastText = o.message; return true; });
});
afterAll(async () => {
  await prisma.loginOtp.deleteMany({ where: { phoneNumber: { in: [OLD, NEW] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [OLD, NEW] } } });
  await prisma.$disconnect();
});

// each test asks for a fresh code: the one-a-minute gap is skipped by moving the stored time back
const wind = (phone: string, purpose: string) => prisma.loginOtp.updateMany({ where: { phoneNumber: phone, purpose }, data: { sentAt: new Date(Date.now() - 120000) } });

describe("sign in with a one-time code", () => {
  it("texts a code, signs in with it once, and the password still works", async () => {
    const r = await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" });
    expect(r.status).toBe(200);
    expect(codeOf()).toMatch(/^\d{6}$/);
    expect((await prisma.loginOtp.findFirst({ where: { phoneNumber: OLD } }))!.codeHash).not.toContain(codeOf()); // only a hash is kept
    const good = await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "login", code: codeOf() });
    expect(good.status).toBe(200);
    expect(good.body.data.token).toBeTruthy();
    expect(good.body.data.user.phoneNumber).toBe(OLD);
    // a code works once
    const again = await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "login", code: codeOf() });
    expect(again.status).toBe(401);
    expect((await api().post("/api/auth/login").send({ identifier: OLD, password: "Test#1234" })).status).toBe(200);
  });

  it("a wrong code fails, and 5 wrong tries kill the code", async () => {
    await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" }).then(() => undefined);
    await wind(OLD, "login");
    await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" });
    const real = codeOf();
    const wrong = real === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "login", code: wrong })).status).toBe(401);
    expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "login", code: real })).status).toBe(429);
  });

  it("asks one code a minute, and says nothing about numbers without an account", async () => {
    await prisma.loginOtp.deleteMany({ where: { phoneNumber: OLD } });
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" })).status).toBe(200);
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" })).status).toBe(429);
    lastText = "";
    const ghost = await api().post("/api/auth/otp/request").send({ phoneNumber: "9800000999", purpose: "login" });
    expect(ghost.status).toBe(200); // same answer as a real number
    expect(lastText).toBe(""); // but nothing was sent
  });

  it("an expired code is refused", async () => {
    await prisma.loginOtp.deleteMany({ where: { phoneNumber: OLD } });
    await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" });
    await prisma.loginOtp.updateMany({ where: { phoneNumber: OLD }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "login", code: codeOf() })).status).toBe(401);
  });
});

describe("new customer: verify the number with a code, then choose a password", () => {
  it("refuses a number that already has an account", async () => {
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "signup" })).status).toBe(409);
  });

  it("code, then password, then the account exists and signs in", async () => {
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: NEW, purpose: "signup" })).status).toBe(200);
    const v = await api().post("/api/auth/otp/verify").send({ phoneNumber: NEW, purpose: "signup", code: codeOf() });
    expect(v.status).toBe(200);
    const signupToken = v.body.data.signupToken as string;
    expect(await prisma.user.findUnique({ where: { phoneNumber: NEW } })).toBeNull(); // nothing is created until a password is chosen

    expect((await api().post("/api/auth/signup/complete").send({ signupToken: "junk", password: "Abc#1234", name: "Nina New", dateOfBirth: "2000-01-01", emergencyName: "Mum", emergencyPhone: "9800000983" })).status).toBe(401);
    expect((await api().post("/api/auth/signup/complete").send({ signupToken, password: "123", name: "Nina New", dateOfBirth: "2000-01-01", emergencyName: "Mum", emergencyPhone: "9800000983" })).status).toBe(400);
    const done = await api().post("/api/auth/signup/complete").send({ signupToken, password: "Abc#1234", name: "Nina New", dateOfBirth: "2000-01-01", emergencyName: "Mum", emergencyPhone: "9800000983" });
    expect(done.status).toBe(201);
    expect(done.body.data.token).toBeTruthy();
    expect((await prisma.user.findUnique({ where: { phoneNumber: NEW } }))!.isVerified).toBe(true);
    expect((await api().post("/api/auth/login").send({ identifier: NEW, password: "Abc#1234" })).status).toBe(200);
    // the same pass cannot create a second account
    expect((await api().post("/api/auth/signup/complete").send({ signupToken, password: "Abc#1234", name: "Nina New", dateOfBirth: "2000-01-01", emergencyName: "Mum", emergencyPhone: "9800000983" })).status).toBe(409);
  });

  it("the password-only sign-up is closed for customers when the code rule is on", async () => {
    const was = process.env.REQUIRE_SIGNUP_OTP;
    process.env.REQUIRE_SIGNUP_OTP = "true";
    try {
      const r = await api().post("/api/auth/signup").send({ phoneNumber: "9800000984", password: "Abc#1234", name: "Sneaky", dateOfBirth: "2000-01-01", emergencyName: "Mum", emergencyPhone: "9800000985" });
      expect(r.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { phoneNumber: "9800000984" } })).toBeNull();
    } finally {
      process.env.REQUIRE_SIGNUP_OTP = was;
    }
  });
});
