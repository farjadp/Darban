-- A published post may carry one photo. Telegram refuses an inline keyboard on
-- a media group, so a post has at most one: the vote buttons matter more than
-- an album. The file_id is kept so the audit trail shows the post had an image
-- and a replayed request can tell it apart from a text-only one.
ALTER TABLE "GuardPost" ADD COLUMN "photoFileId" TEXT;
