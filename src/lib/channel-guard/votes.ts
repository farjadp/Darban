import { db } from "@/lib/db";
import { hasAdminRights } from "./access";
import type { Update } from "./input";
import { checkVote, detectBrigade, isPresent, parseCallback, type Gate } from "./protocol";
import { withChatLock, refreshKeyboard } from "./store";
import { getMember, telegram, TelegramError } from "./telegram";

function gateText(gate: Exclude<Gate, { allowed: true }>) {
  if (gate.reason === "banned") return "امکان رأی دادن برای این حساب در این چت بسته است.";
  if (gate.reason === "membership") return "برای رأی دادن باید عضو این چت باشید.";
  if (gate.reason === "verification") return `ابتدا در پی‌وی @${process.env.GUARD_BOT_USERNAME ?? ""} دستور /start را بفرستید و سپس دوباره رأی دهید.`;
  return `تا پایان دوره‌ی انتظار ${(gate.hours ?? 1).toLocaleString("fa-IR")} ساعت مانده است.`;
}

export async function handleVote(callback: NonNullable<Update["callback_query"]>) {
  let text = "این دکمه برای این پیام معتبر نیست.";
  let accepted = false;
  try {
    const parsed = parseCallback(callback.data ?? "");
    if (!parsed || !callback.message || callback.from.is_bot) return;
    const post = await db.guardPost.findUnique({ where: { id: parsed.postId }, include: { chat: true } });
    if (!post || !post.chat.active || post.status !== "SUCCEEDED" || post.chatId !== callback.message.chat.id || post.messageId !== callback.message.message_id) return;
    const liveMember = await getMember(post.chatId, callback.from.id);
    const result = await withChatLock(post.chatId, async tx => {
      const chat = await tx.guardChat.findUniqueOrThrow({ where: { id: post.chatId } });
      if (!chat.active) return { message: "نگهبان این چت غیرفعال است.", accepted: false };
      const user = await tx.guardUser.upsert({ where: { id: callback.from.id }, create: { id: callback.from.id, name: callback.from.first_name }, update: { name: callback.from.first_name } });
      const member = await tx.guardMember.upsert({ where: { chatId_userId: { chatId: post.chatId, userId: user.id } }, create: { chatId: post.chatId, userId: user.id, present: isPresent(liveMember.status, liveMember.is_member) }, update: {} });
      const now = new Date();
      const gate = checkVote({ ...member, verified: !!user.verifiedAt, present: isPresent(liveMember.status, liveMember.is_member), banned: member.banned || liveMember.status === "kicked" }, chat, now);
      if (!gate.allowed) return { message: gateText(gate), accepted: false };
      const existing = await tx.guardVote.findUnique({ where: { postId_userId: { postId: post.id, userId: user.id } } });
      if (existing && now.getTime() - existing.updatedAt.getTime() < 1000 && existing.choice !== parsed.choice) return { message: "یک لحظه صبر کنید و دوباره رأی دهید.", accepted: false };
      await tx.guardVote.upsert({ where: { postId_userId: { postId: post.id, userId: user.id } }, create: { postId: post.id, userId: user.id, choice: parsed.choice, first: !member.firstVotedAt, createdAt: now }, update: { choice: parsed.choice } });
      if (!member.firstVotedAt) await tx.guardMember.update({ where: { chatId_userId: { chatId: post.chatId, userId: user.id } }, data: { firstVotedAt: now } });
      const recent = await tx.guardVote.findMany({ where: { postId: post.id, first: true, createdAt: { gte: new Date(now.getTime() - 90000) } } });
      const candidates = detectBrigade(recent, now);
      if (candidates.length) {
        const evidence = candidates.map(userId => ({ userId, firstVotedAt: recent.find(vote => vote.userId === userId)!.createdAt.toISOString() }));
        await tx.guardAlert.upsert({ where: { postId: post.id }, create: { chatId: post.chatId, postId: post.id, candidates: evidence }, update: {} });
      }
      await refreshKeyboard(tx, post.id);
      return { message: "رأی شما ثبت شد.", accepted: true };
    });
    text = result.message;
    accepted = result.accepted;
    if (accepted) await notifyAlert(post.id);
  } catch (error) {
    text = "ثبت رأی انجام نشد. کمی بعد دوباره تلاش کنید.";
    throw error;
  } finally {
    try { await telegram("answerCallbackQuery", { callback_query_id: callback.id, text, show_alert: !accepted }); }
    catch (error) { if (!(error instanceof TelegramError)) throw error; }
  }
}

async function notifyAlert(postId: string) {
  const alert = await db.guardAlert.findUnique({ where: { postId }, include: { chat: { include: { admins: true } } } });
  if (!alert || alert.notifiedAt) return;
  const actor = alert.chat.admins.find(a => (process.env.GUARD_ADMIN_IDS ?? "").split(",").map(s => s.trim()).includes(a.userId));
  const appUrl = process.env.APP_URL;
  if (!actor || !appUrl) return;
  try { if (!hasAdminRights(await getMember(alert.chatId, actor.userId))) return; }
  catch { return; }
  const claimed = await db.guardAlert.updateMany({ where: { id: alert.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
  if (!claimed.count) return;
  try {
    await telegram("sendMessage", { chat_id: actor.userId, text: `هشدار برای ${alert.chat.title}: دست‌کم پنج حساب با اولین رأی در این چت، در بازه‌ی ۹۰ ثانیه به یک پست رأی داده‌اند. این فقط نشانه‌ی زمانی است؛ هیچ عضوی حذف نشده است.`, reply_markup: { inline_keyboard: [[{ text: "بررسی هشدار در پنل", url: `${new URL(appUrl).origin}/?chat=${encodeURIComponent(alert.chatId)}&view=alerts` }]] } });
  } catch (error) {
    if (error instanceof TelegramError && !error.uncertain) await db.guardAlert.update({ where: { id: alert.id }, data: { notifiedAt: null } });
  }
}
