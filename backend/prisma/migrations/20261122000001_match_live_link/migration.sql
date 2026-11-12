-- A match can carry the Facebook Live link the tournament organizer pasted; the customer app uses it for "Watch live".
-- Additive and idempotent (the admin portal mirrors it in sql/043).
ALTER TABLE "TournamentMatch" ADD COLUMN IF NOT EXISTS "liveUrl" TEXT;
