CREATE TABLE "GuardChat" (
  "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "type" TEXT NOT NULL, "username" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "waitHours" INTEGER NOT NULL DEFAULT 24,
  "verification" BOOLEAN NOT NULL DEFAULT true, "commentGate" BOOLEAN NOT NULL DEFAULT false,
  "discussionChatId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ChatAdmin" (
  "chatId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  PRIMARY KEY ("chatId", "userId"),
  FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "GuardUser" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3)
);
CREATE TABLE "GuardMember" (
  "chatId" TEXT NOT NULL, "userId" TEXT NOT NULL, "joinedAt" TIMESTAMP(3), "membershipAt" TIMESTAMP(3),
  "banned" BOOLEAN NOT NULL DEFAULT false, "present" BOOLEAN NOT NULL DEFAULT true, "firstVotedAt" TIMESTAMP(3),
  PRIMARY KEY ("chatId", "userId"),
  FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "GuardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "GuardPost" (
  "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL, "chatId" TEXT NOT NULL, "messageId" INTEGER,
  "text" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "GuardVote" (
  "postId" TEXT NOT NULL, "userId" TEXT NOT NULL, "choice" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "first" BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY ("postId", "userId"),
  FOREIGN KEY ("postId") REFERENCES "GuardPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "GuardAlert" (
  "id" TEXT PRIMARY KEY, "chatId" TEXT NOT NULL, "postId" TEXT NOT NULL, "candidates" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3), "reviewedBy" TEXT, "notifiedAt" TIMESTAMP(3),
  FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("postId") REFERENCES "GuardPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "GuardEvent" (
  "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL, "chatId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "targetId" TEXT, "action" TEXT NOT NULL, "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("chatId") REFERENCES "GuardChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "GuardUpdate" (
  "id" TEXT PRIMARY KEY, "completed" BOOLEAN NOT NULL DEFAULT false, "leaseAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "LoginReceipt" ("hash" TEXT PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "GuardChat_discussionChatId_key" ON "GuardChat"("discussionChatId");
CREATE INDEX "ChatAdmin_userId_idx" ON "ChatAdmin"("userId");
CREATE INDEX "GuardMember_chatId_firstVotedAt_idx" ON "GuardMember"("chatId", "firstVotedAt");
CREATE UNIQUE INDEX "GuardPost_requestId_key" ON "GuardPost"("requestId");
CREATE UNIQUE INDEX "GuardPost_chatId_messageId_key" ON "GuardPost"("chatId", "messageId");
CREATE INDEX "GuardVote_postId_createdAt_idx" ON "GuardVote"("postId", "createdAt");
CREATE UNIQUE INDEX "GuardAlert_postId_key" ON "GuardAlert"("postId");
CREATE UNIQUE INDEX "GuardEvent_requestId_key" ON "GuardEvent"("requestId");
CREATE INDEX "GuardEvent_chatId_createdAt_idx" ON "GuardEvent"("chatId", "createdAt");
CREATE INDEX "LoginReceipt_expiresAt_idx" ON "LoginReceipt"("expiresAt");
