-- Additive and idempotent: Watch & Earn (ads watched for loyalty points).
CREATE TABLE IF NOT EXISTS "WatchEarnView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adId" TEXT,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedAt" TIMESTAMP(3),
    CONSTRAINT "WatchEarnView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WatchEarnView_userId_status_idx" ON "WatchEarnView"("userId", "status");
CREATE INDEX IF NOT EXISTS "WatchEarnView_userId_day_idx" ON "WatchEarnView"("userId", "day");
CREATE INDEX IF NOT EXISTS "WatchEarnView_status_startedAt_idx" ON "WatchEarnView"("status", "startedAt");

CREATE TABLE IF NOT EXISTS "WatchEarnStat" (
    "userId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchEarnStat_pkey" PRIMARY KEY ("userId")
);
