-- Two rules need to count what a member has already sent, so they need
-- parameters and somewhere to count. The parameters live on the rule itself
-- rather than on GuardChat, so the next rule that needs a number does not add
-- another column to the chat.
ALTER TABLE "GuardChatRule" ADD COLUMN "limitCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuardChatRule" ADD COLUMN "limitWindowMinutes" INTEGER NOT NULL DEFAULT 0;

-- One row per message seen in a chat that has a counting rule switched on.
-- "fingerprint" is a hash of the text, not the text: the point is only whether
-- two messages were the same, and keeping the words would turn this table into
-- a copy of the group's conversation.
CREATE TABLE "GuardMessageLog" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardMessageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuardMessageLog_chatId_userId_createdAt_idx" ON "GuardMessageLog"("chatId", "userId", "createdAt");
CREATE INDEX "GuardMessageLog_chatId_userId_fingerprint_createdAt_idx" ON "GuardMessageLog"("chatId", "userId", "fingerprint", "createdAt");
-- Rows are pruned by age on write. The index makes that a range delete rather
-- than a scan, which matters because every other table in this schema is
-- documented as never being cleaned up and this one must not join them.
CREATE INDEX "GuardMessageLog_createdAt_idx" ON "GuardMessageLog"("createdAt");
