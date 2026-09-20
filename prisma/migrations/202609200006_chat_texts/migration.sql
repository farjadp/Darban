-- Messages the bot sends, written by the group's own admin. One row per text
-- rather than a column each, for the same reason the rules moved to a table.
-- An empty or missing row means the bot stays quiet: there is no second switch
-- to forget, and nothing is sent by default.
CREATE TABLE "GuardChatText" (
    "chatId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuardChatText_pkey" PRIMARY KEY ("chatId","key")
);

ALTER TABLE "GuardChatText" ADD CONSTRAINT "GuardChatText_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Telegram's own quiet delivery. The bot's messages are housekeeping, not news.
ALTER TABLE "GuardChat" ADD COLUMN "silentBotMessages" BOOLEAN NOT NULL DEFAULT true;
