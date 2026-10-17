-- Additive and idempotent: which controller switches a charging port (manual, or a webhook to a smart plug system).
ALTER TABLE "EvPort" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "EvPort" ADD COLUMN IF NOT EXISTS "providerConfig" TEXT;
