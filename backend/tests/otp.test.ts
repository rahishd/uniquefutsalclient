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

describe("forgot password with a one-time code", () => {
  it("there is no sign-in by code", async () => {
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "login" })).status).toBe(400);
    expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "login", code: "123456" })).status).toBe(400);
  });

  it("texts a code, the code gives a pass once, and the new password works", async () => {
    const r = await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" });
    expect(r.status).toBe(200);
    expect(codeOf()).toMatch(/^\d{6}$/);
    expect((await prisma.loginOtp.findFirst({ where: { phoneNumber: OLD } }))!.codeHash).not.toContain(codeOf()); // only a hash is kept
    const good = await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "reset", code: codeOf() });
    expect(good.status).toBe(200);
    expect(good.body.data.resetToken).toBeTruthy();
    expect(good.body.data.token).toBeUndefined(); // the code alone never signs anyone in
    // a code works once
    const again = await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "reset", code: codeOf() });
    expect(again.status).toBe(401);
    // the pass chooses the new password
    expect((await api().post("/api/auth/otp/reset-password").send({ resetToken: "junk", newPassword: "Newpass#1" })).status).toBe(401);
    expect((await api().post("/api/auth/otp/reset-password").send({ resetToken: good.body.data.resetToken, newPassword: "123" })).status).toBe(400);
    expect((await api().post("/api/auth/otp/reset-password").send({ resetToken: good.body.data.resetToken, newPassword: "Newpass#1" })).status).toBe(200);
    expect((await api().post("/api/auth/login").send({ identifier: OLD, password: "Test#1234" })).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ identifier: OLD, password: "Newpass#1" })).status).toBe(200);
    // a sign-up pass cannot reset a password
    expect((await api().post("/api/auth/otp/reset-password").send({ resetToken: "x.y.z", newPassword: "Newpass#2" })).status).toBe(401);
  });

  it("a wrong code fails, and 5 wrong tries kill the code", async () => {
    await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" }).then(() => undefined);
    await wind(OLD, "reset");
    await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" });
    const real = codeOf();
    const wrong = real === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "reset", code: wrong })).status).toBe(401);
    expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "reset", code: real })).status).toBe(429);
  });

  it("asks one code a minute", async () => {
    await prisma.loginOtp.deleteMany({ where: { phoneNumber: OLD } });
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" })).status).toBe(200);
    expect((await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" })).status).toBe(429);
  });

  it("an unregistered number gets no code and cannot reset with one", async () => {
    lastText = "";
    const ghost = await api().post("/api/auth/otp/request").send({ phoneNumber: "9800000999", purpose: "reset" });
    expect(ghost.status).toBe(404);
    expect(ghost.body.message).toMatch(/not registered/i);
    expect(lastText).toBe(""); // nothing was sent
    expect(await prisma.loginOtp.count({ where: { phoneNumber: "9800000999" } })).toBe(0);
    const verify = await api().post("/api/auth/otp/verify").send({ phoneNumber: "9800000999", purpose: "reset", code: "123456" });
    expect(verify.status).toBe(404);
    expect(await prisma.user.findUnique({ where: { phoneNumber: "9800000999" } })).toBeNull(); // no account appears
  });

  it("a suspended customer gets no code", async () => {
    await prisma.user.update({ where: { phoneNumber: OLD }, data: { isActive: false } });
    try {
      lastText = "";
      const r = await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" });
      expect(r.status).toBe(403);
      expect(lastText).toBe("");
    } finally {
      await prisma.user.update({ where: { phoneNumber: OLD }, data: { isActive: true } });
    }
  });

  it("an expired code is refused", async () => {
    await prisma.loginOtp.deleteMany({ where: { phoneNumber: OLD } });
    await api().post("/api/auth/otp/request").send({ phoneNumber: OLD, purpose: "reset" });
    await prisma.loginOtp.updateMany({ where: { phoneNumber: OLD }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api().post("/api/auth/otp/verify").send({ phoneNumber: OLD, purpose: "reset", code: codeOf() })).status).toBe(401);
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
