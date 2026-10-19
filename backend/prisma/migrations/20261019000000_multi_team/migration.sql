-- A person can captain (and play in) up to 3 teams. The limit is enforced by the service; the database only stops duplicates.
DROP INDEX IF EXISTS "Team_captainId_key";
CREATE INDEX IF NOT EXISTS "Team_captainId_idx" ON "Team"("captainId");

DROP INDEX IF EXISTS "TeamMember_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");

ALTER TABLE "UserPrefs" ADD COLUMN IF NOT EXISTS "activeTeamId" TEXT;
