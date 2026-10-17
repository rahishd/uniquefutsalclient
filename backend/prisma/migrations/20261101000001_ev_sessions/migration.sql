-- Additive and idempotent: EV charging ports (each with a QR token) and app charging sessions (extends EvCharge).
CREATE TABLE IF NOT EXISTS "EvPort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvPort_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EvPort_qrToken_key" ON "EvPort"("qrToken");
ALTER TABLE "EvCharge" ALTER COLUMN "hours" SET DEFAULT 0;
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "portId" TEXT;
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "EvCharge" ADD COLUMN IF NOT EXISTS "minutes" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "EvCharge_userId_createdAt_idx" ON "EvCharge"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EvCharge_portId_status_idx" ON "EvCharge"("portId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "EvCharge_one_charging_per_port" ON "EvCharge"("portId") WHERE "status" = 'charging' AND "portId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "EvCharge_one_charging_per_user" ON "EvCharge"("userId") WHERE "status" = 'charging' AND "userId" IS NOT NULL;
