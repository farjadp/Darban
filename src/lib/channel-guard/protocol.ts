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



