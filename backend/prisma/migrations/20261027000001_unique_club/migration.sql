-- Additive and idempotent: Unique Club (monthly club membership with a 10% discount) and where the discount is recorded.
CREATE TABLE IF NOT EXISTS "ClubMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPaidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payments" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClubMember_userId_key" ON "ClubMember"("userId");
CREATE INDEX IF NOT EXISTS "ClubMember_validUntil_idx" ON "ClubMember"("validUntil");
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "clubDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GzBooking" ADD COLUMN IF NOT EXISTS "clubDiscount" INTEGER NOT NULL DEFAULT 0;
