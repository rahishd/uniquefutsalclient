-- Additive and idempotent: Gift Card (loyalty points or a game bought for a friend).
CREATE TABLE IF NOT EXISTS "Gift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "points" INTEGER,
    "bookingId" TEXT,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_code_key" ON "Gift"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Gift_bookingId_key" ON "Gift"("bookingId");
CREATE INDEX IF NOT EXISTS "Gift_buyerId_createdAt_idx" ON "Gift"("buyerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Gift_friendId_idx" ON "Gift"("friendId");
