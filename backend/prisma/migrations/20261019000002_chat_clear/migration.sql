-- A member can delete a whole chat for themselves (the other people keep it).
ALTER TABLE "ChatMember" ADD COLUMN IF NOT EXISTS "clearedAt" TIMESTAMP(3);
