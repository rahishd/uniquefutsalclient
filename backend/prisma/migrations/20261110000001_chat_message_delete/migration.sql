-- A chat message can be deleted by its sender: the words are erased and the row stays as "deleted". Additive and idempotent.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
