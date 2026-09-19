-- Automatically clean up service join and leave messages in linked discussion groups
-- or managed groups to prevent chat clutter when users enter or exit.
ALTER TABLE "GuardChat" ADD COLUMN "deleteJoinMessages" BOOLEAN NOT NULL DEFAULT false;
