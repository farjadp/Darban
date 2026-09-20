import { db } from "@/lib/db";
import { GuardError, hasAdminRights } from "./access";
import { handlePrivateMessage } from "./commands";
import type { Update } from "./input";
import { checkVote, isPresent, observedJoin, isServiceJoinLeave, isSlashCommand, hasLinkOrMention, hasHashtag, isMediaMessage, detectMediaType, isForwardedMessage, detectForwardOrigin, hasEmoji, isEmojiOnly, wordCountViolation, minutesInZone, withinWindow, fingerprint,
  hasLocation, hasContact, hasPoll, hasGame, isViaBot, hasNoText, hasLatinLetters, hasArabicLetters, matchesBlockedWord } from "./protocol";
import type { RuleKey } from "./protocol";
import { fillTemplate } from "./markup";
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
  const joined = await withChatLock(chat.id, async tx => {
    await tx.guardUser.upsert({ where: { id: user.id }, create: { id: user.id, name: user.first_name }, update: { name: user.first_name } });
    const previous = await tx.guardMember.findUnique({ where: { chatId_userId: { chatId: chat.id, userId: user.id } } });
    if (previous?.membershipAt && previous.membershipAt >= at) return false;
    const joined = observedJoin(change.old_chat_member.status, change.new_chat_member.status, !!change.old_chat_member.is_member, !!change.new_chat_member.is_member);
    const data = { membershipAt: at, present: isPresent(change.new_chat_member.status, change.new_chat_member.is_member), banned: change.new_chat_member.status === "kicked", ...(joined ? { joinedAt: at } : {}) };
    await tx.guardMember.upsert({ where: { chatId_userId: { chatId: chat.id, userId: user.id } }, create: { chatId: chat.id, userId: user.id, ...data }, update: data });
    return joined;
  });
  if (!joined) return;
  await sendChatText(chat, "welcome", { user: user.first_name, group: change.chat.title ?? "" });
}

// متنی که مدیر گروه نوشته. نبودنش یا خالی‌بودنش یعنی چیزی فرستاده نمی‌شود.
// شکستِ ارسال نباید ثبت عضویت را که قبلاً انجام شده خراب کند.
async function sendChatText(
  chat: { id: string; silentBotMessages: boolean },
  key: string,
  values: Record<string, string>,
) {
  const text = await db.guardChatText.findUnique({ where: { chatId_key: { chatId: chat.id, key } } });
  const body = text?.body?.trim();
  if (!body) return;
  const { html } = fillTemplate(body, values);
  try {
    await telegram("sendMessage", { chat_id: chat.id, text: html, parse_mode: "HTML", disable_notification: chat.silentBotMessages });
  } catch (error) {
    if (!(error instanceof TelegramError)) throw error;
  }
}

type GuardChatRow = Awaited<ReturnType<typeof db.guardChat.findMany>>[number];

type Penalty = { penalty: string; muteMinutes: number };

// وقتی همه‌ی مجوزها false باشند تلگرام کاربر را تا until_date ساکت می‌کند.
const MUTED = {
  can_send_messages: false, can_send_audios: false, can_send_documents: false,
  can_send_photos: false, can_send_videos: false, can_send_video_notes: false,
  can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false,
  can_add_web_page_previews: false,
};

// هر اقدام خودکار اول در سوابق ثبت می‌شود، بعد انجام، بعد نتیجه‌اش نوشته می‌شود.
// ردیف تکراری یعنی همین پیام قبلاً رسیدگی شده، پس دوباره اقدام نمی‌شود.
// مجازات SILENCE پیام را هم حذف می‌کند: گذاشتن تبلیغ سر جایش و ساکت‌کردن فرستنده بی‌معنی است.
async function enforce(
  message: NonNullable<Update["message"]>,
  target: { chat: GuardChatRow; rule?: Penalty },
  entry: { key: string; actor: string; action: string; reason: string; targetId: string | null; note?: string },
) {
  const requestId = `${entry.key}:${message.chat.id}:${message.message_id}`;
  const base = `${message.chat.id}/${message.message_id}${entry.note ? ` (${entry.note})` : ""}`;
  const minutes = target.rule?.muteMinutes ?? 60;
  const silence = target.rule?.penalty === "SILENCE" && entry.targetId !== null;
  try {
    await db.guardEvent.create({
      data: {
        requestId,
        chatId: target.chat.id,
        actorId: entry.actor,
        targetId: entry.targetId,
        action: entry.action,
        reason: silence ? `${entry.reason} و سکوت ${minutes} دقیقه‌ای` : entry.reason,
        detail: base,
      },
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
  if (silence) {
    try {
      await telegram("restrictChatMember", {
        chat_id: message.chat.id,
        user_id: entry.targetId,
        permissions: MUTED,
        until_date: Math.floor(Date.now() / 1000) + minutes * 60,
      });
      detail += ` · سکوت ${minutes} دقیقه`;
    } catch (error) {
      // حذف پیام انجام شده؛ شکستِ سکوت نباید آن را ناموفق نشان دهد، ولی باید دیده شود.
      if (!(error instanceof TelegramError)) throw error;
      if (status === "SUCCEEDED") status = error.uncertain ? "UNKNOWN" : "FAILED";
      detail += ` · سکوت ناموفق: ${error.message}`;
    }
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
    include: { rules: true },
  });
  if (chats.length === 0) return;

  // یک قاعده وقتی برخورد می‌کند که روشن باشد و ساعتِ محلیِ همان گروه داخل پنجره‌اش باشد.
  const at = new Date();
  const matchRule = (key: RuleKey) => {
    for (const chat of chats) {
      const rule = chat.rules.find(row => row.rule === key);
      if (!rule?.enabled) continue;
      if (!withinWindow(minutesInZone(at, chat.timezone), rule.startMinute, rule.endMinute)) continue;
      return { chat, rule };
    }
    return undefined;
  };

  if (isServiceJoinLeave(message)) {
    const match = matchRule("join_messages");
    if (match) {
      await enforce(message, match, {
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

  // پیش از قفل اسلش‌کامند، وگرنه گروهی که آن قفل را روشن کرده هیچ‌وقت
  // جواب /rules را نمی‌بیند: قفل پیام را قبل از رسیدن به اینجا حذف می‌کرد.
  if (/^\/rules(@\S+)?\s*$/i.test((message.text ?? "").trim())) {
    const host = chats.find(chat => chat.id === message.chat.id) ?? chats[0];
    await sendChatText(host, "rules", { user: user.first_name, group: message.chat.title ?? "" });
    return;
  }

  // مدیران از همه‌ی قفل‌ها معاف‌اند. تلگرام فقط وقتی پرسیده می‌شود که قاعده‌ای واقعاً برخورد کند،
  // و جوابش برای بقیه‌ی قاعده‌های همین پیام نگه داشته می‌شود.
  let adminCheck: Promise<boolean> | null = null;
  const isAdmin = () => (adminCheck ??= getMember(message.chat.id, user.id).then(hasAdminRights));

  if (isSlashCommand(message.text)) {
    const match = matchRule("commands");
    if (match && !(match.chat.adminsExempt && await isAdmin())) {
      await enforce(message, match, {
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
    const match = matchRule("links");
    if (match && !(match.chat.adminsExempt && await isAdmin())) {
      await enforce(message, match, {
        key: "link-lock",
        actor: "system:link-lock",
        action: "LINK_DELETE",
        reason: "حذف پیام حاوی لینک یا آیدی تلگرام طبق تنظیم قفل لینک",
        targetId: user.id,
      });
      return;
    }
  }

  if (hasHashtag(message)) {
    const match = matchRule("hashtags");
    if (match && !(match.chat.adminsExempt && await isAdmin())) {
      await enforce(message, match, {
        key: "hashtag-lock",
        actor: "system:hashtag-lock",
        action: "HASHTAG_DELETE",
        reason: "حذف پیام حاوی هشتگ کاربر عادی طبق تنظیم قفل هشتگ",
        targetId: user.id,
      });
      return;
    }
  }

  // سکوت: قاعده‌ای بدون شرط محتوا. با پنجره یعنی خاموشی زمان‌بندی‌شده،
  // بدون پنجره یعنی قفل دستی تا وقتی مدیر خاموشش کند.
  const silenceMatch = matchRule("silence");
  if (silenceMatch && !(silenceMatch.chat.adminsExempt && await isAdmin())) {
    await enforce(message, silenceMatch, {
      key: "silence",
      actor: "system:silence",
      action: "SILENCE_DELETE",
      reason: "حذف پیام در بازه‌ی سکوت گروه",
      targetId: user.id,
    });
    return;
  }

  const singles = [
    { key: "location" as const, when: hasLocation, act: "LOCATION_DELETE", why: "حذف موقعیت مکانی طبق تنظیم قفل لوکیشن" },
    { key: "contact" as const, when: hasContact, act: "CONTACT_DELETE", why: "حذف شماره تلفن طبق تنظیم قفل شماره" },
    { key: "poll" as const, when: hasPoll, act: "POLL_DELETE", why: "حذف نظرسنجی طبق تنظیم قفل نظرسنجی" },
    { key: "via_bot" as const, when: isViaBot, act: "VIA_BOT_DELETE", why: "حذف پیام ارسال‌شده از طریق بات دیگر طبق تنظیم قفل کلید شیشه‌ای" },
    { key: "game" as const, when: hasGame, act: "GAME_DELETE", why: "حذف بازی یا اپلیکیشن طبق تنظیم قفل اپلیکیشن" },
    { key: "no_text" as const, when: hasNoText, act: "NO_TEXT_DELETE", why: "حذف پیام بدون متن طبق تنظیم قفل پست بدون متن" },
    { key: "latin" as const, when: hasLatinLetters, act: "LATIN_DELETE", why: "حذف پیام حاوی حروف انگلیسی طبق تنظیم قفل زبان" },
    { key: "arabic" as const, when: hasArabicLetters, act: "ARABIC_DELETE", why: "حذف پیام حاوی حروف عربی یا فارسی طبق تنظیم قفل زبان" },
  ];
  for (const single of singles) {
    if (!single.when(message)) continue;
    const match = matchRule(single.key);
    if (!match || (match.chat.adminsExempt && await isAdmin())) continue;
    await enforce(message, match, {
      key: `${single.key}-lock`,
      actor: `system:${single.key}`,
      action: single.act,
      reason: single.why,
      targetId: user.id,
    });
    return;
  }

  const wordsMatch = matchRule("blocked_words");
  if (wordsMatch) {
    const hit = matchesBlockedWord(message, wordsMatch.rule.wordList);
    if (hit && !(wordsMatch.chat.adminsExempt && await isAdmin())) {
      await enforce(message, wordsMatch, {
        key: "words-block",
        actor: "system:blocked-words",
        action: "BLOCKED_WORD_DELETE",
        // خود کلمه در سوابق نوشته نمی‌شود؛ مدیر خودش فهرست را دارد.
        reason: `حذف پیام حاوی کلمه‌ی ممنوع (${hit.length} نویسه)`,
        targetId: user.id,
      });
      return;
    }
  }

  if (isMediaMessage(message)) {
    const match = matchRule("media");
    if (match && !(match.chat.adminsExempt && await isAdmin())) {
      const mediaType = detectMediaType(message) ?? "media";
      await enforce(message, match, {
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
    const match = matchRule("forwards");
    if (match && !(match.chat.adminsExempt && await isAdmin())) {
      const originType = detectForwardOrigin(message) ?? "forward";
      await enforce(message, match, {
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
    const match = matchRule("emoji") ?? matchRule("empty_emoji");
    if (match && (match.rule.rule === "emoji" || isEmojiOnly(message)) && !(match.chat.adminsExempt && await isAdmin())) {
      await enforce(message, match, {
        key: "emoji-lock",
        actor: "system:emoji-lock",
        action: "EMOJI_DELETE",
        reason: match.rule.rule === "emoji"
          ? "حذف پیام حاوی ایموجی کاربر عادی طبق تنظیم قفل ایموجی"
          : "حذف پیام صرفاً ایموجی (بدون متن) کاربر عادی طبق تنظیم قفل ایموجی خالی",
        targetId: user.id,
      });
      return;
    }
  }

  // تنها قاعده‌هایی که می‌نویسند. سطر فقط وقتی ثبت می‌شود که یکی‌شان روشن باشد،
  // پس گروهی که این‌ها را نمی‌خواهد هیچ نوشتنی اضافه‌ای نمی‌پردازد.
  const rateMatch = matchRule("message_rate");
  const repeatMatch = matchRule("duplicate_messages");
  if (rateMatch || repeatMatch) {
    const counterChat = (rateMatch ?? repeatMatch)!.chat;
    const mark = fingerprint(message);
    const rateWindow = rateMatch?.rule.limitWindowMinutes ?? 0;
    const repeatWindow = repeatMatch?.rule.limitWindowMinutes ?? 0;
    const keepMinutes = Math.max(rateWindow, repeatWindow, 1);
    const since = new Date(at.getTime() - keepMinutes * 60000);

    await db.guardMessageLog.create({ data: { chatId: counterChat.id, userId: user.id, fingerprint: mark, createdAt: at } });
    // هرس بر پایه‌ی سن، همین‌جا. این جدول نباید به فهرست «جدول‌هایی که هرگز پاک نمی‌شوند» اضافه شود.
    await db.guardMessageLog.deleteMany({ where: { chatId: counterChat.id, userId: user.id, createdAt: { lt: since } } });

    if (rateMatch && rateMatch.rule.limitCount > 0 && rateWindow > 0 && !(rateMatch.chat.adminsExempt && await isAdmin())) {
      const seen = await db.guardMessageLog.count({
        where: { chatId: rateMatch.chat.id, userId: user.id, createdAt: { gte: new Date(at.getTime() - rateWindow * 60000) } },
      });
      if (seen > rateMatch.rule.limitCount) {
        await enforce(message, rateMatch, {
          key: "rate-lock",
          actor: "system:message-rate",
          action: "MESSAGE_RATE_DELETE",
          reason: `حذف پیام فراتر از سقف ${rateMatch.rule.limitCount} پیام در ${rateWindow} دقیقه`,
          targetId: user.id,
        });
        return;
      }
    }

    if (repeatMatch && repeatMatch.rule.limitCount > 0 && repeatWindow > 0 && mark && !(repeatMatch.chat.adminsExempt && await isAdmin())) {
      const repeats = await db.guardMessageLog.count({
        where: { chatId: repeatMatch.chat.id, userId: user.id, fingerprint: mark, createdAt: { gte: new Date(at.getTime() - repeatWindow * 60000) } },
      });
      if (repeats > repeatMatch.rule.limitCount) {
        await enforce(message, repeatMatch, {
          key: "repeat-lock",
          actor: "system:duplicate-messages",
          action: "DUPLICATE_DELETE",
          reason: `حذف پیام تکراری فراتر از ${repeatMatch.rule.limitCount} بار در ${repeatWindow} دقیقه`,
          targetId: user.id,
        });
        return;
      }
    }
  }

  const lengthMatch = matchRule("word_limit");
  if (lengthMatch) {
    const breach = wordCountViolation(message, lengthMatch.chat.minWords, lengthMatch.chat.maxWords);
    if (breach && !(lengthMatch.chat.adminsExempt && await isAdmin())) {
      await enforce(message, lengthMatch, {
        key: "words-lock",
        actor: "system:word-limit",
        action: "WORD_LIMIT_DELETE",
        reason: breach === "short"
          ? `حذف پیام کوتاه‌تر از حداقل ${lengthMatch.chat.minWords} کلمه`
          : `حذف پیام بلندتر از حداکثر ${lengthMatch.chat.maxWords} کلمه`,
        targetId: user.id,
        note: breach,
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
  if (chat.adminsExempt && await isAdmin()) return;
  await enforce(message, { chat }, {
    key: "comment",
    actor: "system:comment-gate",
    action: "COMMENT_DELETE",
    reason: "حذف پیام در دوره‌ی انتظار فعال‌شده توسط ادمین",
    targetId: user.id,
  });
}
