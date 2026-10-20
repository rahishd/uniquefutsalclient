-- A chat message can reply to an earlier message in the same chat. Additive and idempotent.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
