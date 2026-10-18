-- Wheelchair access requests from the customer app, answered by staff in the admin portal. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "WheelchairRequest" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "people" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "bookingCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "staffReply" TEXT,
  "repliedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WheelchairRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WheelchairRequest_code_key" ON "WheelchairRequest"("code");
CREATE INDEX IF NOT EXISTS "WheelchairRequest_userId_idx" ON "WheelchairRequest"("userId");
CREATE INDEX IF NOT EXISTS "WheelchairRequest_status_date_idx" ON "WheelchairRequest"("status", "date");
