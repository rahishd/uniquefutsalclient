import { api, makeUser, prisma } from "./helpers";
import smsService from "../src/services/sms.service";
import { clearSmsTemplateCache, renderSms, SMS_DEFAULTS } from "../src/services/smsTemplates";
import { sendBookingSms } from "../src/modules/booking/booking.sms";

const PH = "9800000971";

beforeAll(async () => {
  await prisma.settings.deleteMany({ where: { key: "smsTemplates" } });
  await prisma.smsLog.deleteMany({ where: { phoneNumber: PH } });
  await prisma.loginOtp.deleteMany({ where: { phoneNumber: PH } });
  await prisma.user.deleteMany({ where: { phoneNumber: PH } });
  await makeUser(PH, "Sms Sam");
  clearSmsTemplateCache();
});
afterAll(async () => {
  await prisma.settings.deleteMany({ where: { key: "smsTemplates" } });
  await prisma.smsLog.deleteMany({ where: { phoneNumber: PH } });
  await prisma.loginOtp.deleteMany({ where: { phoneNumber: PH } });
  await prisma.user.deleteMany({ where: { phoneNumber: PH } });
  clearSmsTemplateCache();
  await prisma.$disconnect();
});

describe("SMS templates and the SMS log", () => {
  it("uses the default wording until staff save their own, then the saved wording", async () => {
    expect(await renderSms("booking_cancelled", { name: "Sam", date: "Sat, 15 Nov", time: "18:00" })).toContain("Dear Sam, your booking scheduled for 18:00 on Sat, 15 Nov has been cancelled");
    await prisma.settings.upsert({ where: { key: "smsTemplates" }, update: { value: JSON.stringify({ booking_cancelled: "Hi {name}, {time} on {date} is cancelled." }) }, create: { key: "smsTemplates", value: JSON.stringify({ booking_cancelled: "Hi {name}, {time} on {date} is cancelled." }) } });
    clearSmsTemplateCache();
    expect(await renderSms("booking_cancelled", { name: "Sam", date: "Sat, 15 Nov", time: "18:00" })).toBe("Hi Sam, 18:00 on Sat, 15 Nov is cancelled.");
    expect(await renderSms("otp", { otp: "123456" })).toBe(SMS_DEFAULTS.otp.replace("{otp}", "123456")); // other keys keep the default
  });

  it("a broken saved setting never stops a text: the defaults are used", async () => {
    await prisma.settings.update({ where: { key: "smsTemplates" }, data: { value: "not json" } });
    clearSmsTemplateCache();
    expect(await renderSms("otp", { otp: "111111" })).toContain("111111");
  });

  it("every text is written to the log with its kind, and a failed one says why", async () => {
    await prisma.settings.deleteMany({ where: { key: "smsTemplates" } });
    clearSmsTemplateCache();
    await sendBookingSms("booking_confirmed", { id: "b1", code: "UF-TEST1", date: "2026-11-20", startTime: "18:00", customerName: "Sam", customerPhone: PH, remainingAmount: 500 });
    const row = await prisma.smsLog.findFirst({ where: { phoneNumber: PH, kind: "booking_confirmed" } });
    expect(row).toBeTruthy();
    expect(row!.message).toContain("Please pay Rs. 500 at the venue.");
    expect(row!.bookingCode).toBe("UF-TEST1");
    expect(["queued", "failed"]).toContain(row!.status);
    if (row!.status === "failed") expect(row!.error).toBeTruthy(); // tests have no gateway keys
  });

  it("a one-time code is never stored in the log", async () => {
    const spy = jest.spyOn(smsService, "send");
    const real = spy.getMockImplementation();
    void real;
    await api().post("/api/auth/otp/request").send({ phoneNumber: PH, purpose: "reset" });
    const sent = spy.mock.calls.map((c) => c[0]).find((o) => o.kind === "otp");
    spy.mockRestore();
    expect(sent).toBeTruthy();
    expect(sent!.message).toMatch(/^\d{6} /);
    expect(sent!.logMessage).toContain("••••••");
    const row = await prisma.smsLog.findFirst({ where: { phoneNumber: PH, kind: "otp" } });
    expect(row).toBeTruthy();
    expect(row!.message).not.toMatch(/\d{6}/);
  });
});
