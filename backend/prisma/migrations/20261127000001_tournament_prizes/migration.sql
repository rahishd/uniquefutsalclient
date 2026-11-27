-- The places (1st, 2nd, ...) with a cash prize, trophy and note, kept as JSON; the tournament host fills them in (the admin portal adds the same column).
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "prizes" JSONB NOT NULL DEFAULT '[]'::jsonb;
