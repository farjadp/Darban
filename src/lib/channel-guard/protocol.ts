export type Choice = "agree" | "useful" | "question";
export type VoteMember = { banned: boolean; verified: boolean; present: boolean; joinedAt: Date | null };
export type VoteRules = { verification: boolean; waitHours: number };
export type Gate = { allowed: true } | { allowed: false; reason: "banned" | "verification" | "membership" | "waiting"; hours?: number };
export type VoteEvidence = { userId: string; createdAt: Date; first: boolean };
export const choices: Record<Choice, string> = { agree: "موافقم", useful: "مفید بود", question: "سؤال دارم" };

export function checkVote(member: VoteMember, rules: VoteRules, now: Date): Gate {
  if (member.banned) return { allowed: false, reason: "banned" };
  if (!member.present) return { allowed: false, reason: "membership" };
  if (rules.verification && !member.verified) return { allowed: false, reason: "verification" };
  const remaining = member.joinedAt ? member.joinedAt.getTime() + rules.waitHours * 3600000 - now.getTime() : 0;
  if (rules.waitHours > 0 && remaining > 0) return { allowed: false, reason: "waiting", hours: Math.ceil(remaining / 3600000) };
  return { allowed: true };
}

export function parseCallback(data: string): { postId: string; choice: Choice } | null {
  const match = /^v:([a-zA-Z0-9_-]{1,32}):(agree|useful|question)$/.exec(data);
  return match ? { postId: match[1], choice: match[2] as Choice } : null;
}

export function voteKeyboard(postId: string, counts: Record<Choice, number>) {
  return { inline_keyboard: [Object.entries(choices).map(([key, label]) => ({ text: `${label} · ${counts[key as Choice].toLocaleString("fa-IR")}`, callback_data: `v:${postId}:${key}` }))] };
}

export function detectBrigade(votes: VoteEvidence[], now: Date): string[] {
  const ids = [...new Set(votes.filter(v => v.first && v.createdAt.getTime() >= now.getTime() - 90000 && v.createdAt <= now).map(v => v.userId))];
  return ids.length >= 5 ? ids : [];
}

export function isPresent(status: string, isMember = false): boolean {
  return ["creator", "administrator", "member"].includes(status) || (status === "restricted" && isMember);
}

export function observedJoin(oldStatus: string, newStatus: string, oldMember: boolean, newMember: boolean): boolean {
  return !isPresent(oldStatus, oldMember) && isPresent(newStatus, newMember);
}

export function isServiceJoinLeave(message: {
  new_chat_members?: unknown[];
  new_chat_member?: unknown;
  left_chat_member?: unknown;
}): boolean {
  return (
    (Array.isArray(message.new_chat_members) && message.new_chat_members.length > 0) ||
    Boolean(message.new_chat_member) ||
    Boolean(message.left_chat_member)
  );
}

export function isSlashCommand(text?: string | null): boolean {
  if (!text) return false;
  return /^\/[a-zA-Z0-9_]+/i.test(text.trim());
}

export function hasLinkOrMention(message: {
  text?: string | null;
  caption?: string | null;
  entities?: { type: string; url?: string }[];
  caption_entities?: { type: string; url?: string }[];
}): boolean {
  const allEntities = [...(message.entities ?? []), ...(message.caption_entities ?? [])];
  if (allEntities.some(e => ["url", "text_link", "mention"].includes(e.type))) {
    return true;
  }
  const combined = `${message.text ?? ""} ${message.caption ?? ""}`;
  if (!combined.trim()) return false;
  const linkRegex = /(?:https?:\/\/|t\.me\/|telegram\.me\/|telegram\.dog\/|@[a-zA-Z0-9_]{3,})/i;
  return linkRegex.test(combined);
}

// هشتگ لینک نیست، پس قفل لینک نمی‌گیردش. تلگرام خودش hashtag و cashtag را علامت می‌زند،
// ولی روی متن ویرایش‌شده یا کلاینت غیررسمی ممکن است نزند، پس متن هم خوانده می‌شود.
export function hasHashtag(message: {
  text?: string | null;
  caption?: string | null;
  entities?: { type: string }[];
  caption_entities?: { type: string }[];
}): boolean {
  const allEntities = [...(message.entities ?? []), ...(message.caption_entities ?? [])];
  if (allEntities.some(e => e.type === "hashtag" || e.type === "cashtag")) return true;
  const combined = `${message.text ?? ""} ${message.caption ?? ""}`;
  if (!combined.trim()) return false;
  return /#[\p{L}\p{N}_]+/u.test(combined);
}

// صفر یعنی محدودیت خاموش است. پیامی که اصلاً متن ندارد (استیکر، عکس بی‌کپشن) شمرده نمی‌شود،
// وگرنه حداقلِ کلمات هر استیکری را حذف می‌کرد؛ آن کار قفل رسانه است، نه این.
export function wordCountViolation(
  message: { text?: string | null; caption?: string | null },
  min: number,
  max: number,
): "short" | "long" | null {
  const body = (message.text ?? message.caption ?? "").trim();
  if (!body) return null;
  const words = body.split(/\s+/).length;
  if (min > 0 && words < min) return "short";
  if (max > 0 && words > max) return "long";
  return null;
}

export type MediaType = "photo" | "video" | "animation" | "sticker" | "audio" | "voice" | "document" | "video_note";

export function detectMediaType(message: {
  photo?: unknown;
  video?: unknown;
  animation?: unknown;
  sticker?: unknown;
  audio?: unknown;
  voice?: unknown;
  document?: unknown;
  video_note?: unknown;
}): MediaType | null {
  if (Array.isArray(message.photo) && message.photo.length > 0) return "photo";
  if (message.video) return "video";
  if (message.animation) return "animation";
  if (message.sticker) return "sticker";
  if (message.audio) return "audio";
  if (message.voice) return "voice";
  if (message.video_note) return "video_note";
  if (message.document) return "document";
  return null;
}

export function isMediaMessage(message: {
  photo?: unknown;
  video?: unknown;
  animation?: unknown;
  sticker?: unknown;
  audio?: unknown;
  voice?: unknown;
  document?: unknown;
  video_note?: unknown;
}): boolean {
  return detectMediaType(message) !== null;
}

export type ForwardOriginType = "channel" | "user" | "chat" | "hidden_user" | "external_reply" | "forward";

export function detectForwardOrigin(message: {
  forward_origin?: { type?: string };
  forward_from?: unknown;
  forward_from_chat?: { type?: string };
  forward_sender_name?: string;
  forward_date?: number;
  external_reply?: unknown;
  is_automatic_forward?: boolean;
}): ForwardOriginType | null {
  if (message.is_automatic_forward) return null;
  if (message.forward_origin?.type) {
    if (message.forward_origin.type === "channel") return "channel";
    if (message.forward_origin.type === "user") return "user";
    if (message.forward_origin.type === "chat") return "chat";
    if (message.forward_origin.type === "hidden_user") return "hidden_user";
  }
  if (message.forward_from_chat) {
    return message.forward_from_chat.type === "channel" ? "channel" : "chat";
  }
  if (message.forward_from || message.forward_sender_name) return "user";
  if (message.external_reply) return "external_reply";
  if (message.forward_date) return "forward";
  return null;
}

export function isForwardedMessage(message: {
  forward_origin?: { type?: string };
  forward_from?: unknown;
  forward_from_chat?: { type?: string };
  forward_sender_name?: string;
  forward_date?: number;
  external_reply?: unknown;
  is_automatic_forward?: boolean;
}): boolean {
  return detectForwardOrigin(message) !== null;
}

/**
 * بررسی اینکه آیا پیام حاوی ایموجی است (شامل ایموجی یونیکد، کاستوم ایموجی تلگرام، یا تاس/آیکون متحرک)
 */
export function hasEmoji(message: {
  text?: string;
  caption?: string;
  entities?: Array<{ type: string; offset?: number; length?: number }>;
  caption_entities?: Array<{ type: string; offset?: number; length?: number }>;
  dice?: unknown;
}): boolean {
  if (message.dice) return true;
  const entities = [...(message.entities ?? []), ...(message.caption_entities ?? [])];
  if (entities.some((e) => e.type === "custom_emoji")) return true;
  const text = message.text ?? message.caption ?? "";
  return /\p{Extended_Pictographic}/u.test(text);
}

/**
 * بررسی اینکه آیا پیام صرفاً و فقط از ایموجی تشکیل شده است (بدون محتوای متنی معنادار)
 */
export function isEmojiOnly(message: {
  text?: string;
  caption?: string;
  entities?: Array<{ type: string; offset?: number; length?: number }>;
  caption_entities?: Array<{ type: string; offset?: number; length?: number }>;
  dice?: unknown;
}): boolean {
  if (message.dice) return true;
  const text = message.text ?? message.caption ?? "";
  if (!text.trim()) return false;
  const entities = [...(message.entities ?? []), ...(message.caption_entities ?? [])];
  const hasCustom = entities.some((e) => e.type === "custom_emoji");
  const hasUni = /\p{Extended_Pictographic}/u.test(text);
  if (!hasCustom && !hasUni) return false;

  let cleanText = text;
  // حذف کاستوم ایموجی‌ها از انتهای متن جهت حفظ ایندکس‌های offset
  const customEntities = entities
    .filter((e): e is { type: string; offset: number; length: number } => e.type === "custom_emoji" && typeof e.offset === "number" && typeof e.length === "number")
    .sort((a, b) => b.offset - a.offset);
  for (const ent of customEntities) {
    cleanText = cleanText.slice(0, ent.offset) + cleanText.slice(ent.offset + ent.length);
  }

  // حذف ایموجی‌های یونیکد، اصلاح‌کننده‌های رنگ پوست، انتخابگرهای فرم و نویسه‌های کنترلی
  const stripped = cleanText
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/[\uFE00-\uFE0F]/gu, "")
    .replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/gu, "")
    .replace(/\s+/gu, "");

  return stripped.length === 0;
}



