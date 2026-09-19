import { db } from "@/lib/db";
import { GuardError, hasAdminRights } from "./access";
import { handlePrivateMessage } from "./commands";
import type { Update } from "./input";
import { checkVote, isPresent, observedJoin, isServiceJoinLeave, isSlashCommand, hasLinkOrMention, isMediaMessage, detectMediaType, isForwardedMessage, detectForwardOrigin, hasEmoji, isEmojiOnly } from "./protocol";
import { withChatLock } from "./store";
import { getMember, telegram, TelegramError } from "./telegram";
import { handleVote } from "./votes";

function uniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function handleUpdate(update: Update): Promise<void> {
  const id = String(update.update_id);
  try { await db.guardUpdate.create({ data: { id } }); }
  catch (error) {
    if (!uniqueConflict(error)) throw error;
    const existing = await db.guardUpdate.findUnique({ where: { id } });
    if (existing?.completed) return;
    const claimed = await db.guardUpdate.updateMany({ where: { id, completed: false, leaseAt: { lt: new Date(Date.now() - 300000) } }, data: { leaseAt: new Date() } });
    if (!claimed.count) throw new GuardError("آپدیت در حال پردازش است.", 503);
  }
  try {
    if (update.callback_query) await handleVote(update.callback_query);
    if (update.chat_member) await handleMembership(update.chat_member);
    if (update.my_chat_member) {
      const change = update.my_chat_member;
      await db.guardChat.updateMany({ where: { id: change.chat.id }, data: { active: change.new_chat_member.status === "administrator" } });
    }
    if (update.message?.chat.type === "private") await handlePrivateMessage(update.message, update.update_id);
    else if (update.message) await handleGroupMessage(update.message);
    await db.guardUpdate.update({ where: { id }, data: { completed: true } });
  } catch (error) {
    await db.guardUpdate.update({ where: { id }, data: { leaseAt: new Date(0) } });
    throw error;
  }
}

async function handleMembership(change: NonNullable<Update["chat_member"]>) {
  const chat = await db.guardChat.findUnique({ where: { id: change.chat.id } });
  if (!chat?.active || change.new_chat_member.user.is_bot) return;
  const user = change.new_chat_member.user;
  const at = new Date(change.date * 1000);
  await withChatLock(chat.id, async tx => {
    await tx.guardUser.upsert({ where: { id: user.id }, create: { id: user.id, name: user.first_name }, update: { name: user.first_name } });
    const previous = await tx.guardMember.findUnique({ where: { chatId_userId: { chatId: chat.id, userId: user.id } } });
    if (previous?.membershipAt && previous.membershipAt >= at) return;
    const joined = observedJoin(change.old_chat_member.status, change.new_chat_member.status, !!change.old_chat_member.is_member, !!change.new_chat_member.is_member);
    const data = { membershipAt: at, present: isPresent(change.new_chat_member.status, change.new_chat_member.is_member), banned: change.new_chat_member.status === "kicked", ...(joined ? { joinedAt: at } : {}) };
    await tx.guardMember.upsert({ where: { chatId_userId: { chatId: chat.id, userId: user.id } }, create: { chatId: chat.id, userId: user.id, ...data }, update: data });
  });
}

type GuardChatRow = Awaited<ReturnType<typeof db.guardChat.findMany>>[number];

// هر حذف خودکار اول در سوابق ثبت می‌شود، بعد انجام، بعد نتیجه‌اش نوشته می‌شود.
// ردیف تکراری یعنی همین پیام قبلاً رسیدگی شده، پس دوباره حذف نمی‌شود.
async function recordAndDelete(
  message: NonNullable<Update["message"]>,
  chat: GuardChatRow,
  entry: { key: string; actor: string; action: string; reason: string; targetId: string | null; note?: string },
) {
  const requestId = `${entry.key}:${message.chat.id}:${message.message_id}`;
  const base = `${message.chat.id}/${message.message_id}${entry.note ? ` (${entry.note})` : ""}`;
  try {
    await db.guardEvent.create({
      data: { requestId, chatId: chat.id, actorId: entry.actor, targetId: entry.targetId, action: entry.action, reason: entry.reason, detail: base },
    });
  } catch (error) {
    if (uniqueConflict(error)) return;
    throw error;
  }
  let status = "SUCCEEDED";
  let detail = base;
  try { await telegram("deleteMessage", { chat_id: message.chat.id, message_id: message.message_id }); }
  catch (error) {
    if (!(error instanceof TelegramError)) throw error;
    status = error.uncertain ? "UNKNOWN" : "FAILED";
    detail += `: ${error.message}`;
  }
  await db.guardEvent.update({ where: { requestId }, data: { status, detail } });
}

// بررسی پیام‌های گروه: پاک‌سازی خودکار پیام‌های سرویسی تلگرام یا اعمال قواعد دیدگاه.
// چت‌های مربوط به این پیام یک بار خوانده می‌شوند و هر قاعده روی همان مجموعه ارزیابی می‌شود،
// وگرنه هر پیام گروه به تعداد قاعده‌ها کانکشن از pool می‌گرفت.
async function handleGroupMessage(message: NonNullable<Update["message"]>) {
  const chats = await db.guardChat.findMany({
    where: { active: true, OR: [{ id: message.chat.id }, { discussionChatId: message.chat.id }] },
    orderBy: { id: "asc" },
  });
  if (chats.length === 0) return;

  if (isServiceJoinLeave(message)) {
    const chat = chats.find(rule => rule.deleteJoinMessages);
    if (chat) {
      await recordAndDelete(message, chat, {
        key: "service-msg",
        actor: "system:service-cleanup",
        action: "SERVICE_MESSAGE_DELETE",
        reason: "حذف خودکار پیام سیستمی ورود یا خروج کاربر در گروه",
        targetId: message.from?.id ?? null,
      });
      return;
    }
  }

  const user = message.from;
  if (!user || user.is_bot) return;

  // مدیران از همه‌ی قفل‌ها معاف‌اند. تلگرام فقط وقتی پرسیده می‌شود که قاعده‌ای واقعاً برخورد کند،
  // و جوابش برای بقیه‌ی قاعده‌های همین پیام نگه داشته می‌شود.
  let adminCheck: Promise<boolean> | null = null;
  const isAdmin = () => (adminCheck ??= getMember(message.chat.id, user.id).then(hasAdminRights));

  if (isSlashCommand(message.text)) {
    const chat = chats.find(rule => rule.lockCommands);
    if (chat && !(await isAdmin())) {
      await recordAndDelete(message, chat, {
        key: "cmd-lock",
        actor: "system:command-lock",
        action: "COMMAND_DELETE",
        reason: "حذف دستور اسلش کاربر عادی طبق تنظیم قفل دستورات",
        targetId: user.id,
      });
      return;
    }
  }

  if (hasLinkOrMention(message)) {
    const chat = chats.find(rule => rule.lockLinks);
    if (chat && !(await isAdmin())) {
      await recordAndDelete(message, chat, {
        key: "link-lock",
        actor: "system:link-lock",
        action: "LINK_DELETE",
        reason: "حذف پیام حاوی لینک یا آیدی تلگرام طبق تنظیم قفل لینک",
        targetId: user.id,
      });
      return;
    }
  }

  if (isMediaMessage(message)) {
    const chat = chats.find(rule => rule.lockMedia);
    if (chat && !(await isAdmin())) {
      const mediaType = detectMediaType(message) ?? "media";
      await recordAndDelete(message, chat, {
        key: "media-lock",
        actor: "system:media-lock",
        action: "MEDIA_DELETE",
        reason: `حذف رسانه (${mediaType}) کاربر عادی طبق تنظیم قفل مدیا`,
        targetId: user.id,
        note: mediaType,
      });
      return;
    }
  }

  if (isForwardedMessage(message)) {
    const chat = chats.find(rule => rule.lockForwards);
    if (chat && !(await isAdmin())) {
      const originType = detectForwardOrigin(message) ?? "forward";
      await recordAndDelete(message, chat, {
        key: "fwd-lock",
        actor: "system:forward-lock",
        action: "FORWARD_DELETE",
        reason: `حذف پیام فوروارد (${originType}) کاربر عادی طبق تنظیم قفل فوروارد`,
        targetId: user.id,
        note: originType,
      });
      return;
    }
  }

  if (hasEmoji(message)) {
    const chat = chats.find(rule => rule.lockEmoji || rule.lockEmptyEmoji);
    if (chat && (chat.lockEmoji || isEmojiOnly(message)) && !(await isAdmin())) {
      await recordAndDelete(message, chat, {
        key: "emoji-lock",
        actor: "system:emoji-lock",
        action: "EMOJI_DELETE",
        reason: chat.lockEmoji
          ? "حذف پیام حاوی ایموجی کاربر عادی طبق تنظیم قفل ایموجی"
          : "حذف پیام صرفاً ایموجی (بدون متن) کاربر عادی طبق تنظیم قفل ایموجی خالی",
        targetId: user.id,
      });
      return;
    }
  }

  await handleComment(message, chats, isAdmin);
}

async function handleComment(
  message: NonNullable<Update["message"]>,
  chats: GuardChatRow[],
  isAdmin: () => Promise<boolean>,
) {
  const user = message.from;
  if (!user || message.sender_chat || message.is_automatic_forward) return;
  let chat = null;
  for (const rule of chats) {
    if (!rule.commentGate) continue;
    const member = await db.guardMember.findUnique({ where: { chatId_userId: { chatId: rule.id, userId: user.id } } });
    if (!member?.joinedAt) continue;
    const gate = checkVote({ ...member, banned: false, present: true, verified: true }, { ...rule, verification: false }, new Date());
    if (!gate.allowed && gate.reason === "waiting") { chat = rule; break; }
  }
  if (!chat) return;
  if (await isAdmin()) return;
  await recordAndDelete(message, chat, {
    key: "comment",
    actor: "system:comment-gate",
    action: "COMMENT_DELETE",
    reason: "حذف پیام در دوره‌ی انتظار فعال‌شده توسط ادمین",
    targetId: user.id,
  });
}
