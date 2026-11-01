-- Health tracker: a daily check-in per customer and a play plan with reminder days. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "HealthLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "sleepHours" DOUBLE PRECISION,
  "water" INTEGER,
  "energy" INTEGER,
  "mood" INTEGER,
  "soreness" INTEGER,
  "performance" INTEGER,
  "weightKg" DOUBLE PRECISION,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HealthLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HealthLog_userId_day_key" ON "HealthLog"("userId", "day");
CREATE INDEX IF NOT EXISTS "HealthLog_userId_day_idx" ON "HealthLog"("userId", "day");

CREATE TABLE IF NOT EXISTS "HealthPlan" (
  "userId" TEXT NOT NULL,
  "playDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "remindHour" INTEGER NOT NULL DEFAULT 8,
  "remind" BOOLEAN NOT NULL DEFAULT true,
  "sleepGoal" DOUBLE PRECISION NOT NULL DEFAULT 8,
  "waterGoal" INTEGER NOT NULL DEFAULT 8,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HealthPlan_pkey" PRIMARY KEY ("userId")
);
