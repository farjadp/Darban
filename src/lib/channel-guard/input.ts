import { z } from "zod";

const id = z.union([z.number().int().safe(), z.string().regex(/^-?[0-9]+$/)]).transform(String);
export const userSchema = z.object({ id, is_bot: z.boolean().optional(), first_name: z.string().max(512).default("عضو"), last_name: z.string().max(512).optional() });
const chatSchema = z.object({ id, type: z.string(), title: z.string().optional() });
const statusSchema = z.object({ status: z.string(), is_member: z.boolean().optional(), user: userSchema });
const entitySchema = z.object({ type: z.string(), offset: z.number().int().optional(), length: z.number().int().optional(), url: z.string().optional() });
const messageSchema = z.object({
  message_id: z.number().int(),
  date: z.number().optional(),
  chat: chatSchema,
  from: userSchema.optional(),
  sender_chat: chatSchema.optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  entities: z.array(entitySchema).optional(),
  caption_entities: z.array(entitySchema).optional(),
  is_automatic_forward: z.boolean().optional(),
  photo: z.array(z.unknown()).optional(),
  video: z.unknown().optional(),
  animation: z.unknown().optional(),
  sticker: z.unknown().optional(),
  audio: z.unknown().optional(),
  voice: z.unknown().optional(),
  document: z.unknown().optional(),
  video_note: z.unknown().optional(),
  forward_origin: z.object({ type: z.string().optional() }).passthrough().optional(),
  forward_from: userSchema.optional(),
  forward_from_chat: chatSchema.optional(),
  forward_sender_name: z.string().optional(),
  forward_date: z.number().optional(),
  external_reply: z.unknown().optional(),
  dice: z.unknown().optional(),
  new_chat_members: z.array(userSchema).optional(),
  new_chat_member: userSchema.optional(),
  left_chat_member: userSchema.optional(),
});
const membershipSchema = z.object({ chat: chatSchema, date: z.number().int(), from: userSchema, old_chat_member: statusSchema, new_chat_member: statusSchema });
export const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: messageSchema.optional(),
  chat_member: membershipSchema.optional(),
  my_chat_member: membershipSchema.optional(),
  callback_query: z.object({ id: z.string(), from: userSchema, data: z.string().max(64).optional(), message: messageSchema.optional() }).optional(),
});
export type Update = z.infer<typeof updateSchema>;
export type TelegramUser = z.infer<typeof userSchema>;

const chatId = z.string().regex(/^-\d{1,20}$/);
const requestId = z.string().uuid();
export const adminInput = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("connect"), chatId: z.string().regex(/^(?:-\d{1,20}|@[a-zA-Z0-9_]{5,32})$/) }),
  z.object({ operation: z.literal("publish"), chatId, text: z.string().trim().min(1).max(8192), requestId }),
  z.object({ operation: z.literal("moderate"), chatId, targetId: z.string().regex(/^[1-9]\d{0,19}$/), action: z.enum(["ban", "unban"]), reason: z.string().trim().min(3).max(500), requestId }),
  z.object({ operation: z.literal("settings"), chatId, waitHours: z.number().int().min(0).max(168), verification: z.boolean(), commentGate: z.boolean(), deleteJoinMessages: z.boolean().default(false), lockCommands: z.boolean().default(false), lockLinks: z.boolean().default(false), lockMedia: z.boolean().default(false), lockForwards: z.boolean().default(false), lockEmoji: z.boolean().default(false), lockEmptyEmoji: z.boolean().default(false), lockHashtags: z.boolean().default(false), adminsExempt: z.boolean().default(true), minWords: z.number().int().min(0).max(4096).default(0), maxWords: z.number().int().min(0).max(4096).default(0), discussionChatId: chatId.nullable() }),
  z.object({ operation: z.literal("review"), chatId, alertId: z.string().min(1).max(64) }),
  z.object({ operation: z.literal("sync"), chatId, postId: z.string().min(1).max(64) }),
  z.object({ operation: z.literal("attach"), chatId, postId: z.string().min(1).max(64), messageId: z.number().int().min(1).max(2147483647) }),
]);
