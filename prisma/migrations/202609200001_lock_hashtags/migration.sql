-- Lock hashtags from non-admin members. The link lock already covers @mentions,
-- but a hashtag carries no link and slipped through it.
ALTER TABLE "GuardChat" ADD COLUMN "lockHashtags" BOOLEAN NOT NULL DEFAULT false;
