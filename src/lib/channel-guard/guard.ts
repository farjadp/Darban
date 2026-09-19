import { db } from "@/lib/db";
import { GuardError, hasAdminRights } from "./access";
import { handlePrivateMessage } from "./commands";
import type { Update } from "./input";
import { checkVote, isPresent, observedJoin, isServiceJoinLeave, isSlashCommand, hasLinkOrMention } from "./protocol";
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

// بررسی پیام‌های گروه: پاک‌سازی خودکار پیام‌های سرویسی تلگرام یا اعمال قواعد دیدگاه
async function handleGroupMessage(message: NonNullable<Update["message"]>) {
  if (isServiceJoinLeave(message)) {
    const rules = await db.guardChat.findMany({
      where: { active: true, deleteJoinMessages: true, OR: [{ id: message.chat.id }, { discussionChatId: message.chat.id }] },
      orderBy: { id: "asc" },
    });
    if (rules.length > 0) {
      const chat = rules[0];
      const requestId = `service-msg:${message.chat.id}:${message.message_id}`;
      try {
        await db.guardEvent.create({
          data: {
            requestId,
            chatId: chat.id,
            actorId: "system:service-cleanup",
            targetId: message.from?.id ?? null,
            action: "SERVICE_MESSAGE_DELETE",
            reason: "حذف خودکار پیام سیستمی ورود یا خروج کاربر در گروه",
            detail: `${message.chat.id}/${message.message_id}`,
          },
        });
      } catch (error) {
        if (uniqueConflict(error)) return;
        throw error;
      }
      let status = "SUCCEEDED";
      let detail = `${message.chat.id}/${message.message_id}`;
      try {
        await telegram("deleteMessage", { chat_id: message.chat.id, message_id: message.message_id });
      } catch (error) {
        if (!(error instanceof TelegramError)) throw error;
        status = error.uncertain ? "UNKNOWN" : "FAILED";
        detail += `: ${error.message}`;
      }
      await db.guardEvent.update({ where: { requestId }, data: { status, detail } });
      return;
    }
  }
  if (isSlashCommand(message.text) && message.from && !message.from.is_bot) {
    const rules = await db.guardChat.findMany({
      where: { active: true, lockCommands: true, OR: [{ id: message.chat.id }, { discussionChatId: message.chat.id }] },
      orderBy: { id: "asc" },
    });
    if (rules.length > 0) {
      const user = message.from;
      const isAdmin = hasAdminRights(await getMember(message.chat.id, user.id));
      if (!isAdmin) {
        const chat = rules[0];
        const requestId = `cmd-lock:${message.chat.id}:${message.message_id}`;
        try {
          await db.guardEvent.create({
            data: {
              requestId,
              chatId: chat.id,
              actorId: "system:command-lock",
              targetId: user.id,
              action: "COMMAND_DELETE",
              reason: "حذف دستور اسلش کاربر عادی طبق تنظیم قفل دستورات",
              detail: `${message.chat.id}/${message.message_id}`,
            },
          });
        } catch (error) {
          if (uniqueConflict(error)) return;
          throw error;
        }
        let status = "SUCCEEDED";
        let detail = `${message.chat.id}/${message.message_id}`;
        try {
          await telegram("deleteMessage", { chat_id: message.chat.id, message_id: message.message_id });
        } catch (error) {
          if (!(error instanceof TelegramError)) throw error;
          status = error.uncertain ? "UNKNOWN" : "FAILED";
          detail += `: ${error.message}`;
        }
        await db.guardEvent.update({ where: { requestId }, data: { status, detail } });
        return;
      }
    }
  }
  if (hasLinkOrMention(message) && message.from && !message.from.is_bot) {
    const rules = await db.guardChat.findMany({
      where: { active: true, lockLinks: true, OR: [{ id: message.chat.id }, { discussionChatId: message.chat.id }] },
      orderBy: { id: "asc" },
    });
    if (rules.length > 0) {
      const user = message.from;
      const isAdmin = hasAdminRights(await getMember(message.chat.id, user.id));
      if (!isAdmin) {
        const chat = rules[0];
        const requestId = `link-lock:${message.chat.id}:${message.message_id}`;
        try {
          await db.guardEvent.create({
            data: {
              requestId,
              chatId: chat.id,
              actorId: "system:link-lock",
              targetId: user.id,
              action: "LINK_DELETE",
              reason: "حذف پیام حاوی لینک یا آیدی تلگرام طبق تنظیم قفل لینک",
              detail: `${message.chat.id}/${message.message_id}`,
            },
          });
        } catch (error) {
          if (uniqueConflict(error)) return;
          throw error;
        }
        let status = "SUCCEEDED";
        let detail = `${message.chat.id}/${message.message_id}`;
        try {
          await telegram("deleteMessage", { chat_id: message.chat.id, message_id: message.message_id });
        } catch (error) {
          if (!(error instanceof TelegramError)) throw error;
          status = error.uncertain ? "UNKNOWN" : "FAILED";
          detail += `: ${error.message}`;
        }
        await db.guardEvent.update({ where: { requestId }, data: { status, detail } });
        return;
      }
    }
  }
  await handleComment(message);
}

async function handleComment(message: NonNullable<Update["message"]>) {
  const user = message.from;
  if (!user || user.is_bot || message.sender_chat || message.is_automatic_forward) return;
  const rules = await db.guardChat.findMany({ where: { active: true, commentGate: true, OR: [{ id: message.chat.id }, { discussionChatId: message.chat.id }] }, orderBy: { id: "asc" } });
  let chat = null;
  for (const rule of rules) {
    const member = await db.guardMember.findUnique({ where: { chatId_userId: { chatId: rule.id, userId: user.id } } });
    if (!member?.joinedAt) continue;
    const gate = checkVote({ ...member, banned: false, present: true, verified: true }, { ...rule, verification: false }, new Date());
    if (!gate.allowed && gate.reason === "waiting") { chat = rule; break; }
  }
  if (!chat) return;
  if (hasAdminRights(await getMember(message.chat.id, user.id))) return;
  const requestId = `comment:${message.chat.id}:${message.message_id}`;
  try {
    await db.guardEvent.create({ data: { requestId, chatId: chat.id, actorId: "system:comment-gate", targetId: user.id, action: "COMMENT_DELETE", reason: "حذف پیام در دوره‌ی انتظار فعال‌شده توسط ادمین", detail: `${message.chat.id}/${message.message_id}` } });
  } catch (error) { if (uniqueConflict(error)) return; throw error; }
  let status = "SUCCEEDED";
  let detail = `${message.chat.id}/${message.message_id}`;
  try { await telegram("deleteMessage", { chat_id: message.chat.id, message_id: message.message_id }); }
  catch (error) {
    if (!(error instanceof TelegramError)) throw error;
    status = error.uncertain ? "UNKNOWN" : "FAILED";
    detail += `: ${error.message}`;
  }
  await db.guardEvent.update({ where: { requestId }, data: { status, detail } });
}
