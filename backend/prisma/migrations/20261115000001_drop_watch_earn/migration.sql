-- Watch & Earn is removed from the app. Its two tables (ad views and the running totals) are dropped.
-- Loyalty points already given for ads stay in the points ledger (LoyaltyEntry); only the ad-view records go.
DROP TABLE IF EXISTS "WatchEarnView";
DROP TABLE IF EXISTS "WatchEarnStat";
