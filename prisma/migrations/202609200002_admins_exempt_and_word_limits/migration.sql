-- Until now admins were exempt from every lock with no way to say otherwise.
-- The default keeps that, so no existing group changes behaviour.
ALTER TABLE "GuardChat" ADD COLUMN "adminsExempt" BOOLEAN NOT NULL DEFAULT true;

-- Word limits on a message. Zero means the limit is off, which is why these are
-- not nullable: a group that has never set them reads as "no limit", not "unknown".
ALTER TABLE "GuardChat" ADD COLUMN "minWords" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuardChat" ADD COLUMN "maxWords" INTEGER NOT NULL DEFAULT 0;
