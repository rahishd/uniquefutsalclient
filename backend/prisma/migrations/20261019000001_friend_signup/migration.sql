-- Refer & Earn: a customer registers a friend with a shared first password. The friend must replace it at the first sign-in.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusAt" TIMESTAMP(3);
