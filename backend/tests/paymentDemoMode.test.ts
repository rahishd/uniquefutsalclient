import { execFileSync } from "node:child_process";
import path from "node:path";

// The payment gateway rules live in src/config/env.ts and run when it is imported, so each case starts a fresh process with its own settings.
const root = path.join(__dirname, "..");
function load(extra: Record<string, string>): { ok: boolean; out: string } {
  const env = {
    PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "",
    DATABASE_URL: "postgresql://u:p@db.example.com/prod?sslmode=require",
    JWT_SECRET: "a".repeat(40), REFRESH_TOKEN_SECRET: "b".repeat(40), ...extra,
  };
  const code = "const {isTestGateway}=require('./src/services/paymentGateway');console.log(JSON.stringify({test:isTestGateway()}))";
  try {
    const out = execFileSync(process.execPath, ["--import", "tsx", "-e", code], { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) };
  }
}

describe("test payment gateway on a deployed server", () => {
  it("is refused in production by default", () => {
    const r = load({ NODE_ENV: "production", PAYMENT_GATEWAY: "test" });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/not allowed in production/);
    expect(r.out).toMatch(/ALLOW_TEST_PAYMENTS=true/);
  });

  it("is allowed in production only with the explicit demo switch, and then the test-pay route is available", () => {
    const r = load({ NODE_ENV: "production", PAYMENT_GATEWAY: "test", ALLOW_TEST_PAYMENTS: "true" });
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.out.trim().split("\n").pop()!)).toEqual({ test: true });
  });

  it("any other value of the switch does not count", () => {
    for (const v of ["1", "yes", "TRUE", "false", ""]) {
      expect(load({ NODE_ENV: "production", PAYMENT_GATEWAY: "test", ALLOW_TEST_PAYMENTS: v }).ok).toBe(false);
    }
  });

  it("the demo switch cannot be combined with a real gateway", () => {
    const r = load({ NODE_ENV: "production", PAYMENT_GATEWAY: "fonepay", ALLOW_TEST_PAYMENTS: "true" });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/needs PAYMENT_GATEWAY=test/);
  });

  it("outside production the test gateway works as before", () => {
    const r = load({ NODE_ENV: "development", PAYMENT_GATEWAY: "test", DATABASE_URL: "postgresql://u:p@localhost:5439/x" });
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.out.trim().split("\n").pop()!)).toEqual({ test: true });
  });
});
