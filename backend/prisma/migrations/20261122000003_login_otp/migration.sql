-- One-time codes for sign-in and sign-up by SMS (only a hash of the code is stored). Additive and idempotent.
CREATE TABLE IF NOT EXISTS "LoginOtp" (
  "id" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "tries" INTEGER NOT NULL DEFAULT 0,
  "sends" INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginOtp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoginOtp_phoneNumber_purpose_key" ON "LoginOtp"("phoneNumber", "purpose");
