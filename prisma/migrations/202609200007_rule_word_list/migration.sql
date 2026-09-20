-- The blocked-word rule needs its list, and a rule's parameters belong to the
-- rule. One line per word.
ALTER TABLE "GuardChatRule" ADD COLUMN "wordList" TEXT;
