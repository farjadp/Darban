-- Expand only. The eight boolean columns on GuardChat stay where they are for
-- now: the running container still reads them while the new one boots, and
-- dropping them in the same deploy would break it mid-swap. A later migration
-- removes them once this code is live.

ALTER TABLE "GuardChat" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE "GuardChatRule" (
    "chatId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "penalty" TEXT NOT NULL DEFAULT 'DELETE',
    "muteMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuardChatRule_pkey" PRIMARY KEY ("chatId","rule")
);

ALTER TABLE "GuardChatRule" ADD CONSTRAINT "GuardChatRule_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carry every switch a group has already set into the new table. All hours and
-- the delete penalty: exactly what those booleans meant. Nine plain statements
-- rather than one clever one, because this runs once against real data.

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'join_messages', true, NOW() FROM "GuardChat" WHERE "deleteJoinMessages";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'commands', true, NOW() FROM "GuardChat" WHERE "lockCommands";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'links', true, NOW() FROM "GuardChat" WHERE "lockLinks";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'hashtags', true, NOW() FROM "GuardChat" WHERE "lockHashtags";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'media', true, NOW() FROM "GuardChat" WHERE "lockMedia";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'forwards', true, NOW() FROM "GuardChat" WHERE "lockForwards";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'emoji', true, NOW() FROM "GuardChat" WHERE "lockEmoji";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'empty_emoji', true, NOW() FROM "GuardChat" WHERE "lockEmptyEmoji";

INSERT INTO "GuardChatRule" ("chatId", "rule", "enabled", "updatedAt")
SELECT "id", 'word_limit', true, NOW() FROM "GuardChat" WHERE ("minWords" > 0 OR "maxWords" > 0);
