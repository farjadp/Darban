import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { GuardEvent } from "@/generated/prisma/client";
import { assertActiveAccount, assertTelegramAdmin, GuardError, hasAdminRights, requireChat, requireRestriction } from "./access";
import { adminInput } from "./input";
import { isPresent, voteKeyboard } from "./protocol";
import { refreshKeyboard, withChatLock } from "./store";
import { botId, getMember, telegram, telegramUpload, TelegramError, type ChatInfo, type ChatMember } from "./telegram";
import { render } from "./markup";

type PublishInput = { chatId: string; text: string; requestId: string };
/** One photo, already read and checked by the route. Telegram refuses an inline keyboard on a media group, so never more than one. */
export type PostPhoto = { blob: Blob; filename: string };
// Telegram counts the rendered text, and caps a caption far below a message.
const TEXT_LIMIT = 4096;
const CAPTION_LIMIT = 1024;
type ModerationInput = { chatId: string; targetId: string; action: "ban" | "unban"; reason: string; requestId: string };
type SettingsInput = { chatId: string; waitHours: number; verification: boolean; commentGate: boolean; discussionChatId: string | null };
const banWarning = "درخواست بدون حذف پیام‌ها ارسال شد؛ تلگرام ممکن است طبق قواعد خود پیام‌ها را حذف کند و عدم حذف قابل تضمین نیست.";
const databaseMessage = "ثبت یا خواندن اطلاعات ممکن نشد. نتیجه را در سوابق بررسی کنید؛ عملیات را کورکورانه تکرار نکنید.";

async function safe<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof GuardError || error instanceof TelegramError) throw error;
    throw new GuardError(databaseMessage, 503);
  }
}
function validate(operation: string, input: object) {
  if (!adminInput.safeParse({ ...input, operation }).success) throw new GuardError("اطلاعات درخواست معتبر نیست.", 400);
}
function active(chat: { active: boolean }) {
  if (!chat.active) throw new GuardError("این چت غیرفعال است؛ اتصال مجدد آن را خودکار فعال نمی‌کند.", 409);
}
function posting(chat: { type: string }, member: ChatMember) {
  if (chat.type === "channel" && member.status !== "creator" && !member.can_post_messages) throw new GuardError("دسترسی انتشار در کانال وجود ندارد.", 403);
}
function deletion(member: ChatMember) {
  if (member.status !== "creator" && !member.can_delete_messages) throw new GuardError("بات دسترسی حذف پیام در گروه گفتگو ندارد.", 403);
}
function collision(): never { throw new GuardError("شناسه درخواست قبلاً برای عملیات دیگری استفاده شده است.", 409); }
function replay(event: GuardEvent) {
  if (event.status !== "SUCCEEDED") throw new GuardError(event.status === "FAILED" ? "این درخواست قبلاً ناموفق بوده و دوباره اجرا نمی‌شود." : "نتیجه این درخواست هنوز قطعی نیست؛ بررسی دستی لازم است و ارسال مجدد انجام نمی‌شود.", 409);
  return { status: "SUCCEEDED" as const, eventId: event.id, replayed: true, warning: event.action === "ban" ? banWarning : undefined };
}
function sameEvent(event: GuardEvent, expected: { chatId: string; actorId: string; action: string; targetId?: string | null; reason?: string }) {
  if (event.chatId !== expected.chatId || event.actorId !== expected.actorId || event.action !== expected.action || (event.targetId ?? null) !== (expected.targetId ?? null) || (expected.reason !== undefined && event.reason !== expected.reason)) collision();
}
function requireSendBudget(startedAt: number) {
  const configured = Number(process.env.GUARD_TELEGRAM_TIMEOUT_MS ?? 10000);
  const timeout = Number.isFinite(configured) ? Math.min(20000, Math.max(1000, configured)) : 10000;
  if (Date.now() - startedAt + timeout >= 25000) throw new GuardError("مهلت امن قفل کافی نیست؛ درخواست به تلگرام ارسال نشد.", 409);
}
function failure(error: unknown) {
  return { status: error instanceof GuardError || (error instanceof TelegramError && !error.uncertain) ? "FAILED" : "UNKNOWN", detail: error instanceof TelegramError || error instanceof GuardError ? error.message : "نتیجه ارسال قابل تأیید نیست؛ بررسی دستی لازم است." };
}

export async function connectChat(chatId: string, actorId: string) {
  return safe(async () => {
    validate("connect", { chatId });
    // Any registered, non-suspended customer may connect a chat. Whether they
    // are allowed to is settled by their live Telegram admin rights below, not
    // by a platform allowlist. Checked before the first Telegram call so a
    // suspended account never reaches the API.
    await assertActiveAccount(actorId);
    const info = await telegram<ChatInfo>("getChat", { chat_id: chatId });
    if (!["channel", "supergroup", "group"].includes(info.type) || !Number.isSafeInteger(info.id) || info.id >= 0) throw new GuardError("فقط کانال و گروه قابل اتصال هستند.");
    const canonicalId = String(info.id);
    await assertTelegramAdmin(canonicalId, actorId);
    const bot = await getMember(canonicalId, botId());
    if (!hasAdminRights(bot)) throw new GuardError("بات باید ادمین چت باشد.", 403);
    requireRestriction(bot);
    posting(info, bot);
    return withChatLock(canonicalId, async tx => {
      const data = { title: info.title || canonicalId, type: info.type, username: info.username ?? null };
      const chat = await tx.guardChat.upsert({ where: { id: canonicalId }, create: { id: canonicalId, ...data }, update: data });
      await tx.chatAdmin.upsert({ where: { chatId_userId: { chatId: canonicalId, userId: actorId } }, create: { chatId: canonicalId, userId: actorId }, update: {} });
      await tx.guardEvent.create({ data: { requestId: `connect:${randomUUID()}`, chatId: canonicalId, actorId, action: "connect", reason: "اتصال چت با تأیید زنده دسترسی مدیر و بات", status: "SUCCEEDED" } });
      return chat;
    });
  });
}

export async function publishGuardPost(input: PublishInput, actorId: string, photo?: PostPhoto) {
  return safe(async () => {
    validate("publish", input);
    const body = render(input.text);
    const limit = photo ? CAPTION_LIMIT : TEXT_LIMIT;
    if (body.length > limit) throw new GuardError(photo ? `متن همراه عکس حداکثر ${CAPTION_LIMIT.toLocaleString("fa-IR")} نویسه است.` : `متن پست حداکثر ${TEXT_LIMIT.toLocaleString("fa-IR")} نویسه است.`, 400);
    const { chat, bot } = await requireChat(input.chatId, actorId);
    active(chat); posting(chat, bot);
    const startedAt = Date.now();
    return withChatLock(input.chatId, async () => {
      const reservation = await withChatLock(`request:${input.requestId}`, async () => {
        const [post, event, moderation] = await Promise.all([
          db.guardPost.findUnique({ where: { requestId: input.requestId } }),
          db.guardEvent.findUnique({ where: { requestId: `publish:${input.requestId}` } }),
          db.guardEvent.findUnique({ where: { requestId: input.requestId } }),
        ]);
        if (moderation) collision();
        if (post || event) {
          if (!post || !event || post.chatId !== input.chatId || post.text !== input.text) collision();
          sameEvent(event, { chatId: input.chatId, actorId, action: "publish", targetId: post.id });
          replay(event);
          if (post.status !== "SUCCEEDED" || !post.messageId) throw new GuardError("نتیجه انتشار نیازمند بررسی دستی است.", 409);
          return { post, event, replayed: true };
        }
        return db.$transaction(async tx => {
          const post = await tx.guardPost.create({ data: { chatId: input.chatId, requestId: input.requestId, text: input.text, status: "PENDING" } });
          const event = await tx.guardEvent.create({ data: { requestId: `publish:${input.requestId}`, chatId: input.chatId, actorId, targetId: post.id, action: "publish", reason: "انتشار پست با درخواست صریح مدیر", status: "PENDING" } });
          return { post, event, replayed: false };
        });
      });
      const { post, event } = reservation;
      if (reservation.replayed) return { ...replay(event), postId: post.id, messageId: post.messageId };
      let message: { message_id: number; photo?: { file_id: string }[] };
      try {
        requireSendBudget(startedAt);
        const reply_markup = JSON.stringify(voteKeyboard(post.id, { agree: 0, useful: 0, question: 0 }));
        message = photo
          ? await telegramUpload<{ message_id: number; photo?: { file_id: string }[] }>("sendPhoto", { chat_id: input.chatId, caption: body.html, parse_mode: "HTML", reply_markup }, { field: "photo", blob: photo.blob, filename: photo.filename })
          : await telegram<{ message_id: number }>("sendMessage", { chat_id: input.chatId, text: body.html, parse_mode: "HTML", link_preview_options: { is_disabled: false }, reply_markup: voteKeyboard(post.id, { agree: 0, useful: 0, question: 0 }) });
        if (!Number.isSafeInteger(message?.message_id) || message.message_id <= 0) throw new TelegramError(0, true);
      } catch (error) {
        const result = failure(error);
        await db.$transaction(async tx => {
          await tx.guardPost.update({ where: { id: post.id }, data: { status: result.status } });
          await tx.guardEvent.update({ where: { id: event.id }, data: result });
        });
        throw error;
      }
      try {
        await db.$transaction(async tx => {
          await tx.guardPost.update({ where: { id: post.id }, data: { status: "SUCCEEDED", messageId: message.message_id, photoFileId: message.photo?.at(-1)?.file_id ?? null } });
          await tx.guardEvent.update({ where: { id: event.id }, data: { status: "SUCCEEDED" } });
        });
      } catch {
        await db.guardEvent.update({ where: { id: event.id }, data: { status: "UNKNOWN", detail: `تلگرام انتشار را تأیید کرد؛ ذخیره محلی کامل نشد. message_id=${message.message_id}` } }).catch(() => undefined);
        throw new GuardError(databaseMessage, 503);
      }
      return { status: "SUCCEEDED" as const, postId: post.id, messageId: message.message_id, eventId: event.id, replayed: false };
    });
  });
}

export async function moderateMember(input: ModerationInput, actorId: string) {
  return safe(async () => {
    validate("moderate", input);
    const { chat, actor, bot } = await requireChat(input.chatId, actorId);
    active(chat); requireRestriction(actor); requireRestriction(bot);
    if (input.targetId === actorId || input.targetId === botId()) throw new GuardError("امکان اقدام علیه خود مدیر یا بات وجود ندارد.", 403);
    const startedAt = Date.now();
    const result = await withChatLock(input.chatId, async () => {
      const reservation = await withChatLock(`request:${input.requestId}`, async () => {
        const [event, post] = await Promise.all([
          db.guardEvent.findUnique({ where: { requestId: input.requestId } }),
          db.guardPost.findUnique({ where: { requestId: input.requestId } }),
        ]);
        if (post) collision();
        if (event) { sameEvent(event, { ...input, actorId }); return { event, replayed: true }; }
        const target = await getMember(input.chatId, input.targetId);
        if (hasAdminRights(target) || target.user.is_bot) throw new GuardError("اقدام علیه مدیر، سازنده یا بات مجاز نیست.", 403);
        const created = await db.guardEvent.create({ data: { chatId: input.chatId, requestId: input.requestId, targetId: input.targetId, action: input.action, reason: input.reason, actorId, status: "PENDING" } });
        return { event: created, replayed: false, present: isPresent(target.status, target.is_member) };
      });
      const { event } = reservation;
      if (reservation.replayed) return replay(event);
      try {
        requireSendBudget(startedAt);
        const accepted = await telegram<boolean>(input.action === "ban" ? "banChatMember" : "unbanChatMember", { chat_id: input.chatId, user_id: input.targetId, ...(input.action === "ban" ? { revoke_messages: false } : { only_if_banned: true }) });
        if (accepted !== true) throw new TelegramError(0, true);
      } catch (error) {
        await db.guardEvent.update({ where: { id: event.id }, data: failure(error) });
        throw error;
      }
      try {
        await db.$transaction(async tx => {
          await tx.guardUser.upsert({ where: { id: input.targetId }, create: { id: input.targetId, name: input.targetId }, update: {} });
          await tx.guardMember.upsert({ where: { chatId_userId: { chatId: input.chatId, userId: input.targetId } }, create: { chatId: input.chatId, userId: input.targetId, banned: input.action === "ban", present: input.action === "unban" && reservation.present === true }, update: { banned: input.action === "ban", ...(input.action === "ban" ? { present: false } : {}) } });
          await tx.guardEvent.update({ where: { id: event.id }, data: { status: "SUCCEEDED", detail: input.action === "ban" ? banWarning : null } });
        });
      } catch {
        await db.guardEvent.update({ where: { id: event.id }, data: { status: "UNKNOWN", detail: "تلگرام موفقیت را تأیید کرد؛ ثبت وضعیت عضو کامل نشد. بررسی دستی لازم است." } }).catch(() => undefined);
        throw new GuardError(databaseMessage, 503);
      }
      return { status: "SUCCEEDED" as const, eventId: event.id, replayed: false, warning: input.action === "ban" ? banWarning : undefined };
    });
    if (result.replayed) return result;
    try {
      const posts = await db.guardPost.findMany({ where: { chatId: input.chatId, status: "SUCCEEDED", votes: { some: { userId: input.targetId } } }, select: { id: true } });
      const failures: string[] = [];
      for (const post of posts) {
        try { await withChatLock(input.chatId, tx => refreshKeyboard(tx, post.id)); }
        catch { failures.push(post.id); }
      }
      if (failures.length) throw new GuardError(`همگام‌سازی دکمه‌های ${failures.length} پست انجام نشد؛ همگام‌سازی دستی لازم است.`);
    } catch (error) {
      const detail = error instanceof GuardError ? error.message : "بازخوانی رأی‌ها کامل نشد؛ همگام‌سازی دستی لازم است.";
      await db.guardEvent.update({ where: { id: result.eventId }, data: { detail: [result.warning, detail].filter(Boolean).join(" ") } }).catch(() => undefined);
      return { ...result, warning: [result.warning, detail].filter(Boolean).join(" ") };
    }
    return result;
  });
}

export async function saveSettings(input: SettingsInput, actorId: string) {
  return safe(async () => {
    validate("settings", input);
    const { chat, bot } = await requireChat(input.chatId, actorId);
    active(chat);
    if (input.discussionChatId) {
      if (chat.type !== "channel" || input.discussionChatId === input.chatId) throw new GuardError("گروه گفتگو باید به کانال متصل باشد.");
      const info = await telegram<ChatInfo>("getChat", { chat_id: input.chatId });
      if (String(info.linked_chat_id) !== input.discussionChatId) throw new GuardError("گروه گفتگو به این کانال متصل نیست.");
      const linked = await requireChat(input.discussionChatId, actorId);
      active(linked.chat);
      if (linked.chat.type !== "supergroup") throw new GuardError("گروه گفتگو باید سوپرگروه باشد.");
      deletion(linked.bot);
    } else if (input.commentGate) {
      if (chat.type !== "supergroup") throw new GuardError("برای دروازه گفتگو، گروه متصل را مشخص کنید.");
      deletion(bot);
    }
    return withChatLock(input.chatId, async tx => {
      const chatId = input.chatId;
      const settings = { waitHours: input.waitHours, verification: input.verification, commentGate: input.commentGate, discussionChatId: input.discussionChatId };
      const updated = await tx.guardChat.update({ where: { id: chatId }, data: settings });
      await tx.guardEvent.create({ data: { requestId: `settings:${randomUUID()}`, chatId, actorId, action: "settings", reason: "تغییر تنظیمات با درخواست صریح مدیر", detail: JSON.stringify(settings), status: "SUCCEEDED" } });
      return updated;
    });
  });
}

export async function reviewAlert(input: { chatId: string; alertId: string }, actorId: string) {
  return safe(async () => {
    validate("review", input);
    await requireChat(input.chatId, actorId);
    return withChatLock(input.chatId, async tx => {
      const alert = await tx.guardAlert.findUnique({ where: { id: input.alertId } });
      if (!alert || alert.chatId !== input.chatId) throw new GuardError("گزارش پیدا نشد.", 404);
      if (alert.reviewedAt) return alert;
      const updated = await tx.guardAlert.update({ where: { id: input.alertId }, data: { reviewedAt: new Date(), reviewedBy: actorId } });
      await tx.guardEvent.create({ data: { requestId: `review:${randomUUID()}`, chatId: input.chatId, actorId, action: "review", targetId: input.alertId, reason: "گزارش توسط مدیر بررسی شد؛ هیچ اقدام خودکاری روی اعضا انجام نشد.", status: "SUCCEEDED" } });
      return updated;
    });
  });
}

export async function syncPost(input: { chatId: string; postId: string }, actorId: string) {
  return safe(async () => {
    validate("sync", input);
    const { chat } = await requireChat(input.chatId, actorId);
    active(chat);
    return withChatLock(input.chatId, async tx => {
      const post = await tx.guardPost.findUnique({ where: { id: input.postId } });
      if (!post || post.chatId !== input.chatId) throw new GuardError("پست پیدا نشد.", 404);
      if (post.status !== "SUCCEEDED" || !post.messageId) throw new GuardError("نتیجه انتشار قطعی نیست؛ ابتدا در تلگرام بررسی دستی کنید. انتشار مجدد انجام نمی‌شود.", 409);
      const event = await db.guardEvent.create({ data: { requestId: `sync:${randomUUID()}`, chatId: input.chatId, actorId, targetId: post.id, action: "sync", reason: "همگام‌سازی شمارش رأی‌ها با درخواست مدیر", status: "PENDING" } });
      try { await refreshKeyboard(tx, post.id); }
      catch (error) {
        await db.guardEvent.update({ where: { id: event.id }, data: failure(error) });
        throw error;
      }
      await db.guardEvent.update({ where: { id: event.id }, data: { status: "SUCCEEDED" } });
      return { status: "SUCCEEDED" as const, eventId: event.id };
    });
  });
}
