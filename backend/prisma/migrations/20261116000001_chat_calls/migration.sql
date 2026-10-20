-- One-to-one voice calls between two customers in a direct chat. The row carries the call set-up (offer and answer) and its state. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "ChatCall" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "callerId" TEXT NOT NULL,
  "calleeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ringing',
  "offer" TEXT NOT NULL,
  "answer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "ChatCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChatCall_calleeId_status_idx" ON "ChatCall"("calleeId", "status");
CREATE INDEX IF NOT EXISTS "ChatCall_callerId_status_idx" ON "ChatCall"("callerId", "status");
