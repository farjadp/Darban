import { db } from "@/lib/db";
import { botId, getMember, type ChatMember } from "./telegram";

export class GuardError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
/** Platform operators named in GUARD_ADMIN_IDS. Only the bot's private commands still key off this. */
export function allowedAdmin(id: string) {
  return (process.env.GUARD_ADMIN_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean).includes(id);
}
export function hasAdminRights(member: ChatMember) {
  return member.status === "creator" || member.status === "administrator";
}
/** A registered, non-suspended customer. Checked before any Telegram call so a suspended account never reaches the API. */
export async function assertActiveAccount(actorId: string) {
  const account = await db.account.findUnique({ where: { id: actorId } });
  if (!account || account.status !== "ACTIVE") throw new GuardError("دسترسی مجاز نیست.", 403);
  return account;
}
export async function assertTelegramAdmin(chatId: string, actorId: string) {
  await assertActiveAccount(actorId);
  const member = await getMember(chatId, actorId);
  if (!hasAdminRights(member)) throw new GuardError("در این چت دسترسی ادمین ندارید.", 403);
  return member;
}
export async function requireChat(chatId: string, actorId: string) {
  const grant = await db.chatAdmin.findUnique({ where: { chatId_userId: { chatId, userId: actorId } }, include: { chat: true } });
  if (!grant) throw new GuardError("چت پیدا نشد یا دسترسی ندارید.", 404);
  const actor = await assertTelegramAdmin(chatId, actorId);
  const bot = await getMember(chatId, botId());
  if (!hasAdminRights(bot)) throw new GuardError("بات دیگر ادمین این چت نیست.", 409);
  return { chat: grant.chat, actor, bot };
}
export function requireRestriction(member: ChatMember) {
  if (member.status !== "creator" && !member.can_restrict_members) throw new GuardError("دسترسی حذف عضو وجود ندارد.", 403);
}
