-- The tournament organizer can close team registration by hand (the admin portal mirrors it in sql/047). Additive and idempotent.
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "registrationClosed" BOOLEAN NOT NULL DEFAULT false;
