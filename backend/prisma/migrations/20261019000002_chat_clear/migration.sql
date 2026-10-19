-- A member can delete a whole chat for themselves (the other people keep it).
-- On a fresh database the chat tables do not exist yet at this point (they come in 20261024000001_chat), so this one does nothing there;
-- 20261114000001_chat_clear_column adds the column once the table exists.
ALTER TABLE IF EXISTS "ChatMember" ADD COLUMN IF NOT EXISTS "clearedAt" TIMESTAMP(3);
