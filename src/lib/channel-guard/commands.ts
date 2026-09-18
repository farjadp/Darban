import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { allowedAdmin, GuardError, requireChat } from "./access";
import { moderateMember } from "./actions";
import type { Update } from "./input";
import { telegram, TelegramError } from "./telegram";

export async function handlePrivateMessage(message: NonNullable<Update["message"]>, updateId: number) {
  const user = message.from;
  if (!user || user.is_bot || message.chat.id !== user.id) return;
  const [command, chatId, targetId, ...reason] = (message.text ?? "").trim().split(/\s+/);
  const base = command?.split("@")[0];
  let text = "برای تأیید حساب /start را بفرستید.";
  if (base === "/start") {
    const now = new Date();
    await db.guardUser.upsert({ where: { id: user.id }, create: { id: user.id, name: user.first_name, verifiedAt: now }, update: { name: user.first_name, verifiedAt: now } });
    text = "حساب شما تأیید شد. به پست برگردید و دوباره رأی دهید. تأیید حساب به معنی تأیید هویت یا عقیده نیست.";
    if (allowedAdmin(user.id)) text += "\nدستورهای مدیریت:\n/stats <chat_id>\n/who <chat_id> <user_id>\n/ban <chat_id> <user_id> <دلیل>\n/unban <chat_id> <user_id> <دلیل>\nدستورهای حذف و رفع مسدودیت بلافاصله اجرا و با شناسه‌ی شما ثبت می‌شوند.";
  } else if (allowedAdmin(user.id) && ["/stats", "/who", "/ban", "/unban"].includes(base)) {
    try {
      if (!/^-\d+$/.test(chatId ?? "")) throw new GuardError("شناسه‌ی عددی چت را بعد از دستور وارد کنید.");
      await requireChat(chatId, user.id);
      if (base === "/stats") {
        const [members, posts, alerts] = await Promise.all([db.guardMember.count({ where: { chatId } }), db.guardPost.count({ where: { chatId } }), db.guardAlert.count({ where: { chatId, reviewedAt: null } })]);
        text = `اعضای مشاهده‌شده: ${members.toLocaleString("fa-IR")}\nپست‌ها: ${posts.toLocaleString("fa-IR")}\nهشدارهای باز: ${alerts.toLocaleString("fa-IR")}`;
      } else {
        if (!/^[1-9]\d{0,15}$/.test(targetId ?? "")) throw new GuardError("شناسه‌ی عضو معتبر نیست.");
        if (base === "/who") {
          const member = await db.guardMember.findUnique({ where: { chatId_userId: { chatId, userId: targetId } }, include: { user: true } });
          text = member ? `شناسه: ${targetId}\nتأیید پی‌وی: ${member.user.verifiedAt ? "انجام شده" : "انجام نشده"}\nمسدود: ${member.banned ? "بله" : "خیر"}\nورود مشاهده‌شده: ${member.joinedAt ? member.joinedAt.toLocaleString("fa-IR") : "نامشخص؛ دوره‌ی انتظار اعمال نمی‌شود"}` : "این عضو هنوز توسط بات مشاهده نشده است.";
        } else {
          if (reason.join(" ").length < 3) throw new GuardError("دلیل اقدام را وارد کنید. برای بررسی قبل از اقدام، از پنل استفاده کنید.");
          const key = createHash("sha256").update(`telegram-command:${updateId}`).digest("hex");
          const requestId = `${key.slice(0,8)}-${key.slice(8,12)}-4${key.slice(13,16)}-8${key.slice(17,20)}-${key.slice(20,32)}`;
          await moderateMember({ chatId, targetId, action: base === "/ban" ? "ban" : "unban", reason: reason.join(" ").slice(0,500), requestId }, user.id);
          text = "اقدام با شناسه‌ی شما ثبت شد. رفع مسدودیت، عضو را خودکار به چت برنمی‌گرداند.";
        }
      }
    } catch (error) {
      if (error instanceof GuardError || error instanceof TelegramError) text = error.message;
      else throw error;
    }
  }
  await telegram("sendMessage", { chat_id: user.id, text });
}
