-- Additive and idempotent: the entry fee a team pays to join a tournament (rupees per team, 0 = free). Set in the admin portal.
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "entryFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
