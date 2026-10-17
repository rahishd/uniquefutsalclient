-- Document verification: a short code that proves a bill, receipt or staff-made document is genuine. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "DocVerification" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "title" TEXT,
  "issuedTo" TEXT,
  "orgType" TEXT,
  "details" TEXT,
  "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "issuedBy" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocVerification_code_key" ON "DocVerification"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "DocVerification_sourceType_sourceId_key" ON "DocVerification"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "DocVerification_kind_createdAt_idx" ON "DocVerification"("kind", "createdAt");
