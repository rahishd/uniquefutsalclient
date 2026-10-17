-- Additive and idempotent: paid AC EV charging sessions at the venue.
CREATE TABLE IF NOT EXISTS "EvCharge" (
    "id" TEXT NOT NULL,
    "customerName" TEXT,
    "phone" TEXT,
    "vehicle" TEXT,
    "hours" INTEGER NOT NULL,
    "rate" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "cashAmount" INTEGER NOT NULL DEFAULT 0,
    "onlineAmount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvCharge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EvCharge_createdAt_idx" ON "EvCharge"("createdAt");
