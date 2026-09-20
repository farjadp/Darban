-- The contract half of 202609200003. Those columns were backfilled into
-- GuardChatRule and nothing has read them since 4cc614f went live, so the
-- rows they held are already represented. Dropping them now is safe in a way
-- it would not have been in the same deploy as the expand.
ALTER TABLE "GuardChat"
  DROP COLUMN "deleteJoinMessages",
  DROP COLUMN "lockCommands",
  DROP COLUMN "lockLinks",
  DROP COLUMN "lockMedia",
  DROP COLUMN "lockForwards",
  DROP COLUMN "lockEmoji",
  DROP COLUMN "lockEmptyEmoji",
  DROP COLUMN "lockHashtags";
