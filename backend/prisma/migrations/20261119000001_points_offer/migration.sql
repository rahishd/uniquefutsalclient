-- Loyalty points staff offer to a customer. The customer taps "Add to my points" to take them (status pending -> claimed);
-- staff can withdraw an offer that was not taken yet. Additive and idempotent (the admin portal mirrors it in sql/038).
CREATE TABLE IF NOT EXISTS "PointsOffer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" DECIMAL(8,1) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  CONSTRAINT "PointsOffer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PointsOffer_userId_status_idx" ON "PointsOffer"("userId", "status");
