-- Delete a whole chat for myself: when the member did it. Safe to run twice.
ALTER TABLE "ChatMember" ADD COLUMN IF NOT EXISTS "clearedAt" TIMESTAMP(3);
