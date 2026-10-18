-- How many times a customer has signed in, so the app can stop showing "New" tags to people who know their way around. Additive and idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;
