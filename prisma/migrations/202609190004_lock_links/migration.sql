-- Lock links and mentions for non-admin members in managed and discussion groups
-- to prevent link spam, telegram channel promotions, and unwanted advertising.
ALTER TABLE "GuardChat" ADD COLUMN "lockLinks" BOOLEAN NOT NULL DEFAULT false;
