import dotenv from "dotenv";

dotenv.config();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

/**
 * Safety guard for customer data: outside production the database MUST be local.
 * A development or test run can therefore never touch the real (Neon) customer database,
 * even if someone pastes the production connection string into .env by mistake.
 */
export function assertSafeDatabaseUrl(databaseUrl: string, nodeEnv: string): void {
  if (nodeEnv === "production") return;
  let host = "";
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to start: NODE_ENV=${nodeEnv} but DATABASE_URL points to "${host}". ` +
        "Development and tests must use a local database (see docker-compose.yml) so real customer records are never touched.",
    );
  }
}

const PLACEHOLDER = /^(your_|change[-_ ]?me|secret$)/i;

function requireSecret(name: string, value: string | undefined): string {
  if (!value || value.length < 16 || PLACEHOLDER.test(value)) {
    throw new Error(`${name} must be set to a random string of at least 16 characters.`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) throw new Error("DATABASE_URL is required.");
assertSafeDatabaseUrl(DATABASE_URL, NODE_ENV);

// A demo or test deployment (no real money, no real customers) may keep the test gateway in production by setting ALLOW_TEST_PAYMENTS=true.
// Without it, production refuses the test gateway, because /payments/:order/test-pay lets a signed-in customer mark an order as paid.
const ALLOW_TEST_PAYMENTS = process.env.ALLOW_TEST_PAYMENTS === "true";
if (NODE_ENV === "production" && (process.env.PAYMENT_GATEWAY || "test") === "test" && !ALLOW_TEST_PAYMENTS) {
  throw new Error("PAYMENT_GATEWAY=test is not allowed in production. Configure a real payment gateway first, or for a demo with no real money set ALLOW_TEST_PAYMENTS=true.");
}
if (ALLOW_TEST_PAYMENTS && (process.env.PAYMENT_GATEWAY || "test") !== "test") throw new Error("ALLOW_TEST_PAYMENTS=true needs PAYMENT_GATEWAY=test.");

export const env = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL,
  JWT_SECRET: requireSecret("JWT_SECRET", process.env.JWT_SECRET),
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  REFRESH_TOKEN_SECRET: requireSecret("REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET),
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || "30d",
  // OTP / SMS verification is switched OFF. Signup and login use phone + password only.
  OTP_ENABLED: process.env.OTP_ENABLED === "true",
  // Which payment gateway adapter to use: "test" (local fake) until the real Fonepay keys exist.
  PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || "test",
  ALLOW_TEST_PAYMENTS,
  // Web Push (closed-app alerts). Keys come from `npx web-push generate-vapid-keys`; empty = push is off.
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "",
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  // Optional: STUN/TURN servers for voice calls, as JSON, e.g. [{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]. Without it only free STUN is used and a few networks cannot connect.
  ICE_SERVERS: process.env.ICE_SERVERS || "",
  // Google sign-in used as the second factor for password reset. Empty = reset is unavailable.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  // Face ID / fingerprint sign-in (passkeys). RP ID = the site domain without a port (localhost in development); origins = the exact site addresses.
  WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID || "localhost",
  WEBAUTHN_RP_NAME: process.env.WEBAUTHN_RP_NAME || "Unique Futsal",
  WEBAUTHN_ORIGINS: (process.env.WEBAUTHN_ORIGINS || process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
};

export default env;
