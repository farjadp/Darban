export class TelegramError extends Error {
  constructor(public code: number, public uncertain = false, public notModified = false) {
    super(uncertain ? "پاسخ تلگرام دریافت نشد؛ نتیجه‌ی عملیات باید بررسی شود." : `درخواست تلگرام رد شد (کد ${code.toLocaleString("fa-IR")}).`);
  }
}
export async function telegram<T>(method: string, body: object): Promise<T> {
  const token = process.env.GUARD_BOT_TOKEN;
  if (!token) throw new Error("توکن بات تنظیم نشده است.");
  const configured = Number(process.env.GUARD_TELEGRAM_TIMEOUT_MS ?? 10000);
  const timeout = Number.isFinite(configured) ? Math.min(20000, Math.max(1000, configured)) : 10000;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout), cache: "no-store",
    });
    const data = await response.json() as { ok: boolean; result: T; error_code?: number; description?: string };
    if (!data.ok) throw new TelegramError(data.error_code ?? response.status, false, data.description?.includes("message is not modified"));
    return data.result;
  } catch (error) {
    if (error instanceof TelegramError) throw error;
    throw new TelegramError(0, true);
  }
}

export type ChatInfo = { id: number; title: string; type: string; username?: string; linked_chat_id?: number };
export type ChatMember = { status: string; is_member?: boolean; can_restrict_members?: boolean; can_post_messages?: boolean; can_delete_messages?: boolean; user: { id: number; first_name: string; is_bot?: boolean } };
export function getMember(chatId: string, userId: string) {
  return telegram<ChatMember>("getChatMember", { chat_id: chatId, user_id: userId });
}
export function botId() {
  const id = process.env.GUARD_BOT_TOKEN?.split(":")[0];
  if (!id || !/^\d+$/.test(id)) throw new Error("توکن بات معتبر نیست.");
  return id;
}
