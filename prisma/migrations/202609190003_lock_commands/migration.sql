-- Lock slash commands from regular members in managed and discussion groups
-- to prevent bot command spam and unwanted bot trigger interference.
ALTER TABLE "GuardChat" ADD COLUMN "lockCommands" BOOLEAN NOT NULL DEFAULT false;
