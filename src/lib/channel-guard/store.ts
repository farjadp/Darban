import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { voteKeyboard, type Choice } from "./protocol";
import { telegram, TelegramError } from "./telegram";

export type Tx = Prisma.TransactionClient;
export async function withChatLock<T>(chatId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chatId}, 0))`;
    return work(tx);
  }, { timeout: 30000, maxWait: 10000 });
}
export async function refreshKeyboard(tx: Tx, postId: string) {
  const post = await tx.guardPost.findUniqueOrThrow({ where: { id: postId } });
  if (!post.messageId || post.status !== "SUCCEEDED") return;
  const [votes, banned] = await Promise.all([
    tx.guardVote.findMany({ where: { postId }, select: { userId: true, choice: true } }),
    tx.guardMember.findMany({ where: { chatId: post.chatId, banned: true }, select: { userId: true } }),
  ]);
  const blocked = new Set(banned.map(m => m.userId));
  const counts: Record<Choice, number> = { agree: 0, useful: 0, question: 0 };
  for (const vote of votes) if (!blocked.has(vote.userId) && vote.choice in counts) counts[vote.choice as Choice]++;
  try {
    await telegram("editMessageReplyMarkup", { chat_id: post.chatId, message_id: post.messageId, reply_markup: voteKeyboard(postId, counts) });
  } catch (error) {
    if (!(error instanceof TelegramError && error.notModified)) throw error;
  }
}
