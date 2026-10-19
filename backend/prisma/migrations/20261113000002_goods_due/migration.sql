-- Goods on credit (also made by the customer app for venue orders). Mirrors the admin table; additive and idempotent.
CREATE TABLE IF NOT EXISTS "GoodsDue" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "items" TEXT NOT NULL,
  "lines" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'due',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "paidBy" TEXT,
  "checkoutCode" TEXT,
  CONSTRAINT "GoodsDue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GoodsDue_saleId_key" ON "GoodsDue"("saleId");
CREATE INDEX IF NOT EXISTS "GoodsDue_userId_status_idx" ON "GoodsDue"("userId", "status");
ALTER TABLE "GoodsDue" ADD COLUMN IF NOT EXISTS "onlineAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GoodsDue" ADD COLUMN IF NOT EXISTS "cashAmount" INTEGER NOT NULL DEFAULT 0;
