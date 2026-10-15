-- Additive and idempotent: Find Player advance. The court price at posting time, the court booking made when the host
-- pays the advance, and how long the host has to pay once everyone has joined.
ALTER TABLE "PlayerRequest" ADD COLUMN IF NOT EXISTS "courtPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerRequest" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
ALTER TABLE "PlayerRequest" ADD COLUMN IF NOT EXISTS "advanceDueAt" TIMESTAMP(3);
