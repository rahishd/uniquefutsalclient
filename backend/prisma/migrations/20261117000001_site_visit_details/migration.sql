-- Website visits: what the venue can see about a visitor (IP, place, device, and the account when signed in). Additive and idempotent. The admin portal has the same columns in its sql/037.
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "deviceType" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "deviceName" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "browser" TEXT;
