-- Date of birth (YYYY-MM-DD) asked at sign-up, and the age group a Find Player request is open to. Additive and idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT;
ALTER TABLE "PendingSignup" ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT;
ALTER TABLE "PlayerRequest" ADD COLUMN IF NOT EXISTS "ageGroup" TEXT NOT NULL DEFAULT 'open';
CREATE INDEX IF NOT EXISTS "User_dateOfBirth_idx" ON "User"("dateOfBirth");
