-- Where teams send the tournament entry fee: the eSewa and Khalti numbers the tournament host enters (the admin portal adds the same columns). Additive.
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "esewaNumber" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "khaltiNumber" TEXT;
