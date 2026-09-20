import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    account: { findUnique: vi.fn() },
    chatAdmin: { findUnique: vi.fn(), upsert: vi.fn() },
    guardChat: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    guardChatRule: { upsert: vi.fn() },
    guardEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    guardPost: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    guardUser: { upsert: vi.fn() },
    guardMember: { upsert: vi.fn(), findMany: vi.fn() },
    guardVote: { findMany: vi.fn() },
    guardAlert: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
  telegram: vi.fn(), telegramUpload: vi.fn(), getMember: vi.fn(), getUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./telegram", async (original) => ({ ...await original<typeof import("./telegram")>(), telegram: mocks.telegram, telegramUpload: mocks.telegramUpload, getMember: mocks.getMember }));
vi.mock("@/lib/auth", async (original) => ({ ...await original<typeof import("@/lib/auth")>(), getUser: mocks.getUser }));

import { attachPost, connectChat, moderateMember, publishGuardPost, saveSettings, reviewAlert, syncPost } from "./actions";
import { TelegramError } from "./telegram";
import { POST } from "@/app/api/admin/route";
import { runSetup } from "../../../scripts/setup-channel-guard";

const chatId = "-100123";
const actorId = "11";
const requestId = "3297dd39-2a1b-4e43-bb3d-bb39dc6fe3d0";
const input = { chatId, targetId: "22", action: "ban" as const, reason: "Explicit spam report", requestId };
const chat = { id: chatId, active: true, type: "channel", title: "Example", discussionChatId: null };
const events = new Map<string, Record<string, unknown>>();
const posts = new Map<string, Record<string, unknown>>();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GUARD_ADMIN_IDS", actorId);
  vi.stubEnv("GUARD_BOT_TOKEN", "99:token");
  vi.stubEnv("APP_URL", "https://guard.example");
  events.clear(); posts.clear();
  mocks.getUser.mockResolvedValue({ id: actorId, name: "Admin" });
  const locks = new Map<string, Promise<void>>();
  mocks.db.$transaction.mockImplementation(async (work: (tx: typeof mocks.db) => unknown) => {
    const releases: Array<() => void> = [];
    const tx = { ...mocks.db, $executeRaw: vi.fn(async (_sql: TemplateStringsArray, key: string) => {
      const previous = locks.get(key) ?? Promise.resolve();
      let release!: () => void;
      locks.set(key, new Promise<void>(resolve => { release = resolve; }));
      await previous;
      releases.push(release);
    }) };
    try { return await work(tx); }
    finally { for (const release of releases) release(); }
  });
  mocks.db.account.findUnique.mockImplementation(async ({ where }) => where.id === actorId ? { id: actorId, status: "ACTIVE" } : null);
  mocks.db.chatAdmin.findUnique.mockResolvedValue({ chat });
  mocks.db.guardChat.findUnique.mockResolvedValue(chat);
  mocks.getMember.mockImplementation(async (_chat: string, id: string) => ({ status: id === "22" ? "member" : "administrator", can_restrict_members: true, can_post_messages: true, can_delete_messages: true, user: { id: Number(id), first_name: "Member" } }));
  mocks.telegram.mockResolvedValue(true);
  mocks.db.guardEvent.findUnique.mockImplementation(async ({ where }) => events.get(where.requestId) ?? null);
  mocks.db.guardEvent.create.mockImplementation(async ({ data }) => {
    if ("operation" in data) throw new Error("Unknown argument operation");
    if (events.has(data.requestId)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
    const event = { id: data.requestId, ...data }; events.set(data.requestId, event); return event;
  });
  mocks.db.guardEvent.update.mockImplementation(async ({ where, data }) => {
    const event = events.get(where.requestId ?? where.id)!; Object.assign(event, data); return event;
  });
  mocks.db.guardPost.findUnique.mockImplementation(async ({ where }) => posts.get(where.requestId) ?? [...posts.values()].find(p => p.id === where.id) ?? null);
  mocks.db.guardPost.create.mockImplementation(async ({ data }) => {
    if ("operation" in data) throw new Error("Unknown argument operation");
    const post = { id: "post1", ...data }; posts.set(data.requestId, post); return post;
  });
  mocks.db.guardPost.update.mockImplementation(async ({ where, data }) => {
    const post = [...posts.values()].find(p => p.id === where.id)!; Object.assign(post, data); return post;
  });
  mocks.db.guardPost.findMany.mockResolvedValue([]);
  mocks.db.guardPost.findFirst.mockResolvedValue(null);
  mocks.db.guardChat.upsert.mockResolvedValue(chat);
  mocks.db.guardChat.update.mockResolvedValue(chat);
});

const mutations = () => mocks.telegram.mock.calls.filter(([method]) => ["banChatMember", "unbanChatMember", "sendMessage"].includes(method));

describe("defensive admin operations", () => {
  it("rejects an actor without this chat's grant", async () => {
    mocks.db.chatAdmin.findUnique.mockResolvedValue(null);
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 404 });
    expect(mutations()).toHaveLength(0);
  });
  it("allows active registered customers outside the platform allowlist", async () => {
    vi.stubEnv("GUARD_ADMIN_IDS", "99");
    await moderateMember(input, actorId);
    expect(mutations()).toHaveLength(1);
  });
  it("blocks suspended customers despite an existing grant", async () => {
    mocks.db.account.findUnique.mockResolvedValue({ id: actorId, status: "SUSPENDED" });
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 403 });
    expect(mutations()).toHaveLength(0);
  });
  it("rejects unregistered customers despite an existing grant", async () => {
    await expect(moderateMember(input, "44")).rejects.toMatchObject({ status: 403 });
    expect(mutations()).toHaveLength(0);
  });
  it.each(["creator", "administrator"])("protects %s targets", async (status) => {
    mocks.getMember.mockResolvedValue({ status, can_restrict_members: true, user: { id: 22 } });
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 403 });
    expect(mutations()).toHaveLength(0);
  });
  it.each([actorId, "99"])("protects self and bot target %s", async (targetId) => {
    await expect(moderateMember({ ...input, targetId }, actorId)).rejects.toMatchObject({ status: 403 });
    expect(mutations()).toHaveLength(0);
  });
  it("commits PENDING before ban and never executes a duplicate", async () => {
    mocks.telegram.mockImplementation(async () => { expect(events.get(requestId)?.status).toBe("PENDING"); return true; });
    await moderateMember(input, actorId);
    await moderateMember(input, actorId);
    expect(mutations()).toHaveLength(1);
    expect(events.get(requestId)).toMatchObject({ status: "SUCCEEDED", actorId, targetId: "22", reason: input.reason });
    expect(mocks.db.guardMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ banned: true }) }));
    expect(mutations()[0][1]).toMatchObject({ revoke_messages: false });
  });
  it("rejects idempotency key collisions", async () => {
    await moderateMember(input, actorId);
    await expect(moderateMember({ ...input, targetId: "23" }, actorId)).rejects.toMatchObject({ status: 409 });
    expect(mutations()).toHaveLength(1);
  });
  it("uses only_if_banned for unban and clears local banned state", async () => {
    await moderateMember({ ...input, action: "unban" }, actorId);
    expect(mutations()[0]).toEqual(["unbanChatMember", { chat_id: chatId, user_id: "22", only_if_banned: true }]);
    expect(mocks.db.guardMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ banned: false }) }));
  });
  it("does not mark an existing member absent on a no-op unban", async () => {
    await moderateMember({ ...input, action: "unban" }, actorId);
    expect(mocks.db.guardMember.upsert.mock.calls[0][0].update).not.toHaveProperty("present");
  });
  it("serializes concurrent moderation in the same chat", async () => {
    let release!: () => void;
    mocks.telegram.mockImplementationOnce(() => new Promise<boolean>(resolve => { release = () => resolve(true); })).mockResolvedValue(true);
    const first = moderateMember(input, actorId);
    await vi.waitFor(() => expect(mutations()).toHaveLength(1));
    const second = moderateMember({ ...input, requestId: "d5185b07-d1b9-43e9-b0f4-c86f4789f918", action: "unban" }, actorId);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mutations()).toHaveLength(1);
    release();
    await Promise.all([first, second]);
    expect(mutations().map(([method]) => method)).toEqual(["banChatMember", "unbanChatMember"]);
  });
  it("deduplicates simultaneous requests", async () => {
    await Promise.all([moderateMember(input, actorId), moderateMember(input, actorId)]);
    expect(mutations()).toHaveLength(1);
  });
  it.each([actorId, "99"])("requires live restriction permission from %s", async (id) => {
    mocks.getMember.mockImplementation(async (_chat: string, userId: string) => ({ status: "administrator", can_restrict_members: id !== userId, user: { id: Number(userId) } }));
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 403 });
    expect(mutations()).toHaveLength(0);
  });
  it("keeps moderation successful when keyboard refresh fails", async () => {
    mocks.db.guardPost.findMany.mockResolvedValue([{ id: "post1" }]);
    mocks.db.guardPost.findUniqueOrThrow.mockResolvedValue({ id: "post1", chatId, messageId: 101, status: "SUCCEEDED" });
    mocks.db.guardVote.findMany.mockResolvedValue([{ userId: "22", choice: "agree" }]);
    mocks.db.guardMember.findMany.mockResolvedValue([{ userId: "22" }]);
    mocks.telegram.mockImplementation(async method => { if (method === "editMessageReplyMarkup") throw new TelegramError(403); return true; });
    const result = await moderateMember(input, actorId);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.warning).toContain("همگام‌سازی");
    expect(events.get(requestId)).toMatchObject({ status: "SUCCEEDED", detail: expect.stringContaining("همگام‌سازی") });
    const keyboard = mocks.telegram.mock.calls.find(([method]) => method === "editMessageReplyMarkup")?.[1].reply_markup;
    expect(keyboard.inline_keyboard[0][0].text).toContain("۰");
  });
  it("marks post-send persistence failure uncertain and never sends again", async () => {
    mocks.db.guardMember.upsert.mockRejectedValue(new Error("private database failure"));
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 503 });
    expect(events.get(requestId)?.status).toBe("UNKNOWN");
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 409 });
    expect(mutations()).toHaveLength(1);
  });
  it("persists UNKNOWN on ambiguous Telegram failure and does not replay", async () => {
    mocks.telegram.mockRejectedValue(new TelegramError(0, true));
    await expect(moderateMember(input, actorId)).rejects.toBeDefined();
    expect(events.get(requestId)?.status).toBe("UNKNOWN");
    await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 409 });
    expect(mutations()).toHaveLength(1);
  });
  it("persists FAILED without raw exception details", async () => {
    mocks.telegram.mockRejectedValue(new TelegramError(403));
    await expect(moderateMember(input, actorId)).rejects.toBeDefined();
    expect(events.get(requestId)?.status).toBe("FAILED");
  });
  it("does not mutate Telegram if the audit cannot be saved", async () => {
    mocks.db.guardEvent.create.mockRejectedValue(new Error("database secret"));
    await expect(moderateMember(input, actorId)).rejects.not.toThrow("database secret");
    expect(mutations()).toHaveLength(0);
  });
  it("publishes once with an initial vote keyboard, and authored angle brackets stay literal", async () => {
    mocks.telegram.mockImplementation(async (method) => method === "sendMessage" ? { message_id: 101 } : true);
    await publishGuardPost({ chatId, text: "<b>Literal</b>", requestId }, actorId);
    await publishGuardPost({ chatId, text: "<b>Literal</b>", requestId }, actorId);
    expect(mutations()).toHaveLength(1);
    // Escaped on the wire is what makes Telegram render it as the text the author typed.
    expect(mutations()[0][1]).toMatchObject({ text: "&lt;b&gt;Literal&lt;/b&gt;", parse_mode: "HTML", reply_markup: { inline_keyboard: expect.any(Array) } });
    expect(posts.get(requestId)).toMatchObject({ status: "SUCCEEDED", messageId: 101 });
    expect(events.get(`publish:${requestId}`)?.status).toBe("SUCCEEDED");
  });
  it("turns the author's markers into Telegram formatting", async () => {
    mocks.telegram.mockImplementation(async (method) => method === "sendMessage" ? { message_id: 102 } : true);
    await publishGuardPost({ chatId, text: "*پررنگ* و [لینک](https://darban.xyz/)", requestId }, actorId);
    expect(mutations()[0][1]).toMatchObject({ text: '<b>پررنگ</b> و <a href="https://darban.xyz/">لینک</a>', parse_mode: "HTML" });
  });
  it("refuses a post longer than Telegram accepts, counting the text and not the markers", async () => {
    await expect(publishGuardPost({ chatId, text: `*${"ا".repeat(4097)}*`, requestId }, actorId)).rejects.toMatchObject({ status: 400 });
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
    // 4096 of text plus two markers is still within the limit.
    mocks.telegram.mockImplementation(async (method) => method === "sendMessage" ? { message_id: 103 } : true);
    await expect(publishGuardPost({ chatId, text: `*${"ا".repeat(4096)}*`, requestId }, actorId)).resolves.toMatchObject({ status: "SUCCEEDED" });
  });
  it("sends a photo as an upload with the text as its caption, under the caption limit", async () => {
    mocks.telegramUpload.mockResolvedValue({ message_id: 104, photo: [{ file_id: "small" }, { file_id: "largest" }] });
    const photo = { blob: new Blob([new Uint8Array([1, 2, 3])]), filename: "cover.jpg" };
    await publishGuardPost({ chatId, text: "*عنوان*", requestId }, actorId, photo);
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
    expect(mocks.telegramUpload).toHaveBeenCalledWith("sendPhoto", expect.objectContaining({ chat_id: chatId, caption: "<b>عنوان</b>", parse_mode: "HTML" }), expect.objectContaining({ field: "photo", filename: "cover.jpg" }));
    expect(posts.get(requestId)).toMatchObject({ status: "SUCCEEDED", messageId: 104, photoFileId: "largest" });
  });
  it("refuses a caption longer than a caption may be, even though a text post could hold it", async () => {
    const photo = { blob: new Blob([new Uint8Array([1])]), filename: "cover.jpg" };
    await expect(publishGuardPost({ chatId, text: "ا".repeat(1025), requestId }, actorId, photo)).rejects.toMatchObject({ status: 400 });
    expect(mocks.telegramUpload).not.toHaveBeenCalled();
  });
  it("never blindly resends an ambiguous publish", async () => {
    mocks.telegram.mockRejectedValue(new TelegramError(0, true));
    await expect(publishGuardPost({ chatId, text: "Post", requestId }, actorId)).rejects.toBeDefined();
    await expect(publishGuardPost({ chatId, text: "Post", requestId }, actorId)).rejects.toMatchObject({ status: 409 });
    expect(posts.get(requestId)?.status).toBe("UNKNOWN");
    expect(mutations()).toHaveLength(1);
  });
  it("rejects cross-operation reuse of a global request ID", async () => {
    await moderateMember(input, actorId);
    await expect(publishGuardPost({ chatId, text: "Post", requestId }, actorId)).rejects.toMatchObject({ status: 409 });
    expect(mutations()).toHaveLength(1);
  });
  it("connects using the canonical ID and does not reactivate an inactive chat", async () => {
    mocks.telegram.mockResolvedValue({ id: Number(chatId), title: "Example", type: "channel" });
    mocks.db.guardChat.findUnique.mockResolvedValue({ ...chat, active: false });
    await connectChat("@ExampleChannel", actorId);
    expect(mocks.db.guardChat.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: chatId }, update: expect.not.objectContaining({ active: true }) }));
    expect(mocks.db.chatAdmin.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.db.chatAdmin.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { chatId, userId: actorId } }));
  });
  it("lets a registered customer outside the platform allowlist connect a chat", async () => {
    vi.stubEnv("GUARD_ADMIN_IDS", "");
    mocks.telegram.mockResolvedValue({ id: Number(chatId), title: "Example", type: "channel" });
    await connectChat("@ExampleChannel", actorId);
    expect(mocks.db.chatAdmin.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { chatId, userId: actorId } }));
  });
  it("refuses a suspended account before asking Telegram anything", async () => {
    mocks.db.account.findUnique.mockResolvedValue({ id: actorId, status: "SUSPENDED" });
    await expect(connectChat("@ExampleChannel", actorId)).rejects.toMatchObject({ status: 403 });
    expect(mocks.telegram).not.toHaveBeenCalled();
    expect(mocks.db.chatAdmin.upsert).not.toHaveBeenCalled();
  });
  it("refuses an account that has never registered", async () => {
    mocks.db.account.findUnique.mockResolvedValue(null);
    await expect(connectChat("@ExampleChannel", actorId)).rejects.toMatchObject({ status: 403 });
    expect(mocks.telegram).not.toHaveBeenCalled();
  });
  it("rejects unrelated discussion groups", async () => {
    mocks.telegram.mockResolvedValue({ id: Number(chatId), type: "channel", linked_chat_id: -999 });
    await expect(saveSettings({ chatId, waitHours: 24, verification: true, commentGate: true, discussionChatId: "-1234" }, actorId)).rejects.toMatchObject({ status: 400 });
    expect(mocks.db.guardChat.update).not.toHaveBeenCalled();
  });
  it("saves the chat-level settings and upserts every rule", async () => {
    mocks.db.chatAdmin.findUnique.mockResolvedValue({ chat: { ...chat, type: "supergroup" } });
    await saveSettings({
      chatId, waitHours: 0, verification: false, commentGate: true,
      adminsExempt: false, minWords: 3, maxWords: 0, timezone: "Asia/Tehran",
      rules: [
        { rule: "links", enabled: true, startMinute: 1320, endMinute: 360, penalty: "SILENCE", muteMinutes: 120 },
        { rule: "media", enabled: false, startMinute: null, endMinute: null, penalty: "DELETE", muteMinutes: 60 },
      ],
      discussionChatId: null,
    }, actorId);
    expect(mocks.db.guardChat.update).toHaveBeenCalledWith({
      where: { id: chatId },
      data: { waitHours: 0, verification: false, commentGate: true, adminsExempt: false, minWords: 3, maxWords: 0, timezone: "Asia/Tehran", discussionChatId: null },
    });
    expect(mocks.db.guardChatRule.upsert).toHaveBeenCalledWith({
      where: { chatId_rule: { chatId, rule: "links" } },
      create: { chatId, rule: "links", enabled: true, startMinute: 1320, endMinute: 360, penalty: "SILENCE", muteMinutes: 120, limitCount: 0, limitWindowMinutes: 0 },
      update: { enabled: true, startMinute: 1320, endMinute: 360, penalty: "SILENCE", muteMinutes: 120, limitCount: 0, limitWindowMinutes: 0 },
    });
    // خاموش‌کردن یک قاعده هم باید نوشته شود، وگرنه خاموشی ذخیره نمی‌شد
    expect(mocks.db.guardChatRule.upsert).toHaveBeenCalledTimes(2);
    expect([...events.values()][0]).toMatchObject({ action: "settings", actorId, status: "SUCCEEDED" });
  });
  it("refuses to enable a rule on a channel with no discussion group", async () => {
    mocks.db.chatAdmin.findUnique.mockResolvedValue({ chat: { ...chat, type: "channel" } });
    await expect(saveSettings({
      chatId, waitHours: 0, verification: false, commentGate: false,
      rules: [{ rule: "links", enabled: true, startMinute: null, endMinute: null, penalty: "DELETE", muteMinutes: 60 }],
      discussionChatId: null,
    }, actorId)).rejects.toMatchObject({ status: 400 });
    expect(mocks.db.guardChat.update).not.toHaveBeenCalled();
  });
  it("requires a grant and bot delete permission for the linked discussion group", async () => {
    mocks.telegram.mockResolvedValue({ id: Number(chatId), linked_chat_id: -1234 });
    mocks.db.chatAdmin.findUnique.mockImplementation(async ({ where }) => ({ chat: where.chatId_userId.chatId === chatId ? chat : { ...chat, id: "-1234", type: "supergroup" } }));
    mocks.getMember.mockImplementation(async (id, user) => ({ status: "administrator", can_delete_messages: id !== "-1234", user: { id: Number(user) } }));
    await expect(saveSettings({ chatId, waitHours: 24, verification: true, commentGate: true, discussionChatId: "-1234" }, actorId)).rejects.toMatchObject({ status: 403 });
    expect(mocks.db.guardChat.update).not.toHaveBeenCalled();
  });
  it("reviews an alert without any member mutation", async () => {
    mocks.db.guardAlert.findUnique.mockResolvedValue({ id: "alert", chatId, reviewedAt: null });
    await reviewAlert({ chatId, alertId: "alert" }, actorId);
    expect(mocks.db.guardAlert.update).toHaveBeenCalledWith({ where: { id: "alert" }, data: { reviewedAt: expect.any(Date), reviewedBy: actorId } });
    expect([...events.values()][0]).toMatchObject({ action: "review", targetId: "alert", actorId, status: "SUCCEEDED" });
    expect(mutations()).toHaveLength(0);
  });
  it("does not synchronize or resend an uncertain post", async () => {
    posts.set(requestId, { id: "post1", chatId, status: "UNKNOWN" });
    await expect(syncPost({ chatId, postId: "post1" }, actorId)).rejects.toMatchObject({ status: 409 });
    expect(mocks.telegram).not.toHaveBeenCalled();
  });
  it("does not send moderation after most of the lock lifetime is spent waiting", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(20000);
    try {
      await expect(moderateMember(input, actorId)).rejects.toMatchObject({ status: 409 });
      expect(events.get(requestId)?.status).toBe("FAILED");
      expect(mutations()).toHaveLength(0);
    } finally { clock.mockRestore(); }
  });
  it("scopes review and sync to the authorized chat", async () => {
    mocks.db.guardAlert.findUnique.mockResolvedValue({ id: "alert", chatId: "-999" });
    posts.set("other", { id: "other", chatId: "-999" });
    await expect(reviewAlert({ chatId, alertId: "alert" }, actorId)).rejects.toMatchObject({ status: 404 });
    await expect(syncPost({ chatId, postId: "other" }, actorId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("adopting a post Telegram never confirmed", () => {
  const unconfirmed = () => posts.set(requestId, { id: "post1", chatId, status: "UNKNOWN", messageId: null });
  beforeEach(() => {
    mocks.db.guardPost.findUniqueOrThrow.mockImplementation(async ({ where }) => [...posts.values()].find(p => p.id === where.id));
    mocks.db.guardVote.findMany.mockResolvedValue([]);
    mocks.db.guardMember.findMany.mockResolvedValue([]);
  });

  it("claims the live message by writing this post's own keyboard onto it", async () => {
    unconfirmed();
    await attachPost({ chatId, postId: "post1", messageId: 77 }, actorId);
    expect(mocks.telegram).toHaveBeenCalledWith("editMessageReplyMarkup", expect.objectContaining({
      chat_id: chatId, message_id: 77,
      reply_markup: { inline_keyboard: [expect.arrayContaining([expect.objectContaining({ callback_data: "v:post1:agree" })])] },
    }));
    expect(posts.get(requestId)).toMatchObject({ status: "SUCCEEDED", messageId: 77 });
    expect([...events.values()][0]).toMatchObject({ action: "attach", targetId: "post1", actorId, status: "SUCCEEDED" });
  });

  it("keeps the post unconfirmed when Telegram refuses the edit", async () => {
    unconfirmed();
    // The row is written before the edit, so undoing it is the transaction's
    // job; the mock rolls back the same way Postgres would.
    const commit = mocks.db.$transaction.getMockImplementation()!;
    mocks.db.$transaction.mockImplementation(async (work: never) => {
      const snapshot = [...posts].map(([key, post]) => [key, { ...post }] as const);
      try { return await commit(work); }
      catch (error) { posts.clear(); for (const [key, post] of snapshot) posts.set(key, post); throw error; }
    });
    mocks.telegram.mockRejectedValue(new TelegramError(400, false, false, "message to edit not found"));
    await expect(attachPost({ chatId, postId: "post1", messageId: 77 }, actorId)).rejects.toBeInstanceOf(TelegramError);
    expect(posts.get(requestId)).toMatchObject({ status: "UNKNOWN", messageId: null });
  });

  it("refuses a message id another post already holds, and a post that is already confirmed", async () => {
    unconfirmed();
    mocks.db.guardPost.findFirst.mockResolvedValue({ id: "post0", chatId, messageId: 77 });
    await expect(attachPost({ chatId, postId: "post1", messageId: 77 }, actorId)).rejects.toMatchObject({ status: 409 });
    mocks.db.guardPost.findFirst.mockResolvedValue(null);
    posts.set(requestId, { id: "post1", chatId, status: "SUCCEEDED", messageId: 12 });
    await expect(attachPost({ chatId, postId: "post1", messageId: 77 }, actorId)).rejects.toMatchObject({ status: 409 });
    expect(mocks.telegram).not.toHaveBeenCalledWith("editMessageReplyMarkup", expect.anything());
  });

  it("does not adopt a post in a chat the admin did not name", async () => {
    posts.set(requestId, { id: "other", chatId: "-999", status: "UNKNOWN", messageId: null });
    await expect(attachPost({ chatId, postId: "other", messageId: 77 }, actorId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("setup safety", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/guard");
    vi.stubEnv("AUTH_SESSION_SECRET", "s".repeat(32));
    vi.stubEnv("GUARD_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("GUARD_BOT_USERNAME", "ExampleGuardBot");
    mocks.telegram.mockImplementation(async (method) => method === "getMe" ? { id: 99, is_bot: true, username: "ExampleGuardBot" } : method === "getWebhookInfo" ? { url: "https://elsewhere.example/secret", pending_update_count: 7 } : true);
  });
  it("inspects but never mutates Telegram by default", async () => {
    const result = await runSetup([]);
    expect(mocks.telegram.mock.calls.map(([method]) => method)).toEqual(["getMe", "getWebhookInfo"]);
    expect(result).toMatchObject({ applied: false, pendingUpdates: 7 });
    expect(JSON.stringify(result)).not.toContain("https://elsewhere.example/secret");
    expect(JSON.stringify(result)).not.toContain("w".repeat(32));
  });
  it("applies only explicitly and preserves pending updates", async () => {
    await runSetup(["--apply"]);
    expect(mocks.telegram).toHaveBeenCalledWith("setWebhook", expect.objectContaining({ url: "https://guard.example/api/channel-guard/telegram", max_connections: 1, allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"], secret_token: "w".repeat(32) }));
    expect(mocks.telegram.mock.calls.find(([method]) => method === "setWebhook")?.[1]).not.toHaveProperty("drop_pending_updates");
  });
  it.each([["APP_URL", "http://guard.example"], ["GUARD_WEBHOOK_SECRET", "bad secret"], ["GUARD_BOT_USERNAME", "invalid"], ["GUARD_ADMIN_IDS", ""], ["DATABASE_URL", ""]])("rejects invalid %s before any request", async (key, value) => {
    vi.stubEnv(key, value);
    await expect(runSetup([])).rejects.toBeDefined();
    expect(mocks.telegram).not.toHaveBeenCalled();
  });
  it("rejects a configured username that is not the token's bot", async () => {
    vi.stubEnv("GUARD_BOT_USERNAME", "OtherGuardBot");
    await expect(runSetup(["--apply"])).rejects.toBeDefined();
    expect(mocks.telegram.mock.calls.some(([method]) => method.startsWith("set"))).toBe(false);
  });
});

function request(body: string, origin = "https://guard.example") {
  return new Request("https://guard.example/api/admin", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body });
}

describe("admin API boundaries", () => {
  it("dispatches validated moderation without passing transport fields to Prisma", async () => {
    const response = await POST(request(JSON.stringify({ operation: "moderate", ...input })));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, result: { status: "SUCCEEDED" } });
  });
  it("dispatches validated publishing without passing transport fields to Prisma", async () => {
    mocks.telegram.mockResolvedValue({ message_id: 101 });
    const response = await POST(request(JSON.stringify({ operation: "publish", chatId, text: "Post", requestId })));
    expect(response.status).toBe(200);
  });
  it("checks authentication before parsing invalid JSON", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await POST(request("{"))).status).toBe(401);
  });
  it("rejects cross-origin requests before parsing", async () => {
    expect((await POST(request("{", "https://evil.example"))).status).toBe(403);
  });
  it("rejects invalid JSON and invalid operation bodies", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ operation: "moderate" })))).status).toBe(400);
  });
  it("limits streamed UTF-8 bytes without trusting content-length", async () => {
    const response = await POST(request(JSON.stringify({ text: "ی".repeat(33000) })));
    expect(response.status).toBe(413);
  });
  it("does not return ok true for uncertain replays", async () => {
    events.set(requestId, { ...input, actorId, status: "UNKNOWN" });
    const response = await POST(request(JSON.stringify({ operation: "moderate", ...input })));
    expect(response.status).toBe(409);
    expect(await response.json()).not.toMatchObject({ ok: true });
    expect(mutations()).toHaveLength(0);
  });
});
