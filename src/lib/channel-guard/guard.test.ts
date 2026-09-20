import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: { guardUpdate: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, guardChat: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() }, guardUser: { upsert: vi.fn() }, guardPost: { findUnique: vi.fn() }, guardMember: { findUnique: vi.fn() }, guardEvent: { create: vi.fn(), update: vi.fn() }, guardMessageLog: { create: vi.fn(), count: vi.fn(), deleteMany: vi.fn() }, guardChatText: { findUnique: vi.fn() }, $transaction: vi.fn() },
  telegram: vi.fn(), getMember: vi.fn(), moderateMember: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./telegram", () => ({ telegram: mocks.telegram, getMember: mocks.getMember, botId: () => "999", TelegramError: class extends Error {} }));
vi.mock("./actions", () => ({ moderateMember: mocks.moderateMember }));
import { handleUpdate } from "./guard";

beforeEach(() => { vi.resetAllMocks(); mocks.db.guardUpdate.create.mockResolvedValue({}); mocks.db.guardUpdate.update.mockResolvedValue({}); mocks.db.guardChat.findMany.mockResolvedValue([]); mocks.telegram.mockResolvedValue(true); mocks.db.guardMessageLog.count.mockResolvedValue(0); mocks.db.guardChatText.findUnique.mockResolvedValue(null);
  // withChatLock فقط یک تراکنش با قفل مشورتی است؛ اینجا خودِ کار را اجرا می‌کنیم.
  mocks.db.$transaction.mockImplementation(async (work: (tx: unknown) => unknown) => work({
    $executeRaw: vi.fn(),
    guardUser: { upsert: vi.fn() },
    guardMember: { findUnique: mocks.db.guardMember.findUnique, upsert: vi.fn() },
  }));
});
// ردیف GuardChat در دیتابیس هیچ‌وقت ستون کم ندارد، پس fixture هم نباید داشته باشد.
// هر بار که این‌ها دستی نوشته شدند، افزودن یک ستون جدید تست‌ها را به‌دلیل اشتباه شکست.
const chatRow = ({ rules = [], ...overrides }: Record<string, unknown> & { rules?: Record<string, unknown>[] }) => ({
  active: true,
  verification: false,
  commentGate: false,
  adminsExempt: true,
  minWords: 0,
  maxWords: 0,
  timezone: "UTC",
  silentBotMessages: true,
  ...overrides,
  rules: rules.map(rule => ({ enabled: true, startMinute: null, endMinute: null, penalty: "DELETE", muteMinutes: 60, limitCount: 0, limitWindowMinutes: 0, ...rule })),
});

describe("webhook behavior", () => {
  it("checks both group and linked-channel waiting rules before accepting a comment", async () => {
    const group = chatRow({ id: "-200", waitHours: 0, verification: false, commentGate: true });
    const channel = chatRow({ id: "-100", waitHours: 24, verification: false, commentGate: true });
    mocks.db.guardChat.findFirst.mockResolvedValue(group);
    mocks.db.guardChat.findMany.mockResolvedValue([group, channel]);
    mocks.db.guardMember.findUnique.mockResolvedValue({ joinedAt: new Date() });
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({ update_id: 6, message: { message_id: 4, chat: { id: "-200", type: "supergroup" }, from: { id: "1", first_name: "عضو" }, text: "دیدگاه" } });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 4 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ chatId: "-100", action: "COMMENT_DELETE" }) }));
  });
  it("deletes join and leave service messages when deleteJoinMessages is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "join_messages" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    await handleUpdate({
      update_id: 7,
      message: {
        message_id: 5,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "1", first_name: "عضو جدید" },
        new_chat_members: [{ id: "1", first_name: "عضو جدید" }],
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 5 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chatId: "-200", action: "SERVICE_MESSAGE_DELETE" }) })
    );
  });
  it("deletes slash commands sent by regular members when lockCommands is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "commands" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 8,
      message: {
        message_id: 6,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "2", first_name: "عضو عادی" },
        text: "/help",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 6 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chatId: "-200", action: "COMMAND_DELETE" }) })
    );
  });
  it("allows slash commands sent by admins even when lockCommands is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "commands" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator" });
    await handleUpdate({
      update_id: 9,
      message: {
        message_id: 7,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "3", first_name: "مدیر گروه" },
        text: "/stats",
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "COMMAND_DELETE" }) })
    );
  });
  it("reads the chat rules once and asks Telegram about the sender once, whatever the message trips", async () => {
    const group = chatRow({ id: "-200", active: true, commentGate: true, rules: [{ rule: "links" }, { rule: "media" }, { rule: "forwards" }, { rule: "emoji" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator" });
    await handleUpdate({
      update_id: 30,
      message: {
        message_id: 24,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "4", first_name: "مدیر گروه" },
        caption: "کانال ما 😀 https://t.me/example_channel",
        photo: [{ file_id: "p1" }],
        forward_origin: { type: "channel" },
      },
    });
    expect(mocks.db.guardChat.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.getMember).toHaveBeenCalledTimes(1);
  });
  it("deletes messages containing links or mentions sent by regular members when lockLinks is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "links" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 10,
      message: {
        message_id: 8,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "2", first_name: "عضو عادی" },
        text: "کانال ما: https://t.me/example_channel",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 8 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chatId: "-200", action: "LINK_DELETE" }) })
    );
  });
  it("allows messages containing links or mentions sent by admins even when lockLinks is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "links" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator" });
    await handleUpdate({
      update_id: 11,
      message: {
        message_id: 9,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "3", first_name: "مدیر گروه" },
        text: "لینک رسمی: https://t.me/example_channel",
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "LINK_DELETE" }) })
    );
  });
  it("applies a lock to an admin when the chat turns admin exemption off", async () => {
    const group = chatRow({ id: "-200", active: true, adminsExempt: false, rules: [{ rule: "links" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator" });
    await handleUpdate({
      update_id: 33,
      message: {
        message_id: 27,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "6", first_name: "مدیر گروه" },
        text: "https://t.me/example_channel",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 27 });
    // وقتی معافیت خاموش است اصلاً لازم نیست از تلگرام بپرسیم طرف مدیر هست یا نه
    expect(mocks.getMember).not.toHaveBeenCalled();
  });
  it("deletes a message under the minimum word count", async () => {
    const group = chatRow({ id: "-200", active: true, adminsExempt: true, minWords: 3, maxWords: 0, rules: [{ rule: "word_limit" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 34,
      message: {
        message_id: 28,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "7", first_name: "عضو عادی" },
        text: "سلام",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 28 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "WORD_LIMIT_DELETE" }) })
    );
  });
  it("leaves a sticker alone even under a minimum word count", async () => {
    const group = chatRow({ id: "-200", active: true, adminsExempt: true, minWords: 3, maxWords: 0, rules: [{ rule: "word_limit" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 35,
      message: {
        message_id: 29,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "7", first_name: "عضو عادی" },
        sticker: { file_id: "s1" },
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
  });
  it("holds a rule back outside its hours and applies it inside them", async () => {
    // ۰۰:۰۰ تا ۰۶:۰۰ به وقت تهران، یعنی ۲۰:۳۰ تا ۰۲:۳۰ به وقت UTC
    const group = chatRow({ id: "-200", timezone: "Asia/Tehran", rules: [{ rule: "links", startMinute: 0, endMinute: 360 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    const message = { message_id: 40, chat: { id: "-200", type: "supergroup" }, from: { id: "8", first_name: "عضو عادی" }, text: "https://t.me/x" };

    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
    await handleUpdate({ update_id: 40, message });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());

    vi.setSystemTime(new Date("2026-09-20T22:00:00Z"));
    await handleUpdate({ update_id: 41, message: { ...message, message_id: 41 } });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 41 });
    vi.useRealTimers();
  });
  it("mutes the sender as well when the penalty is SILENCE", async () => {
    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
    const group = chatRow({ id: "-200", rules: [{ rule: "links", penalty: "SILENCE", muteMinutes: 120 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 42,
      message: { message_id: 42, chat: { id: "-200", type: "supergroup" }, from: { id: "9", first_name: "عضو عادی" }, text: "https://t.me/x" },
    });
    // پیام هم حذف می‌شود: گذاشتن تبلیغ سر جایش و ساکت‌کردن فرستنده بی‌معنی است
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 42 });
    expect(mocks.telegram).toHaveBeenCalledWith("restrictChatMember", expect.objectContaining({
      chat_id: "-200",
      user_id: "9",
      until_date: Math.floor(new Date("2026-09-20T12:00:00Z").getTime() / 1000) + 120 * 60,
    }));
    vi.useRealTimers();
  });
  it("does not mute when the penalty is left at DELETE", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "links" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 43,
      message: { message_id: 43, chat: { id: "-200", type: "supergroup" }, from: { id: "9", first_name: "عضو عادی" }, text: "https://t.me/x" },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("restrictChatMember", expect.anything());
  });
  it("deletes everything from a member during a silence window", async () => {
    vi.setSystemTime(new Date("2026-09-20T23:00:00Z"));
    const group = chatRow({ id: "-200", rules: [{ rule: "silence", startMinute: 1380, endMinute: 360 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 70,
      message: { message_id: 70, chat: { id: "-200", type: "supergroup" }, from: { id: "20", first_name: "عضو" }, text: "سلام" },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 70 });
    vi.useRealTimers();
  });
  it("lets the same message through outside the silence window", async () => {
    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
    const group = chatRow({ id: "-200", rules: [{ rule: "silence", startMinute: 1380, endMinute: 360 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 71,
      message: { message_id: 71, chat: { id: "-200", type: "supergroup" }, from: { id: "20", first_name: "عضو" }, text: "سلام" },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    vi.useRealTimers();
  });
  it("deletes a blocked word and keeps the word itself out of the record", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "blocked_words", wordList: "تبلیغ" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 72,
      message: { message_id: 72, chat: { id: "-200", type: "supergroup" }, from: { id: "20", first_name: "عضو" }, text: "یک تبلیغ" },
    });
    const call = mocks.db.guardEvent.create.mock.calls.at(-1)?.[0] as { data: { action: string; reason: string } };
    expect(call.data.action).toBe("BLOCKED_WORD_DELETE");
    expect(call.data.reason).not.toContain("تبلیغ");
  });
  it("deletes a shared location when that rule is on", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "location" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 73,
      message: { message_id: 73, chat: { id: "-200", type: "supergroup" }, from: { id: "20", first_name: "عضو" }, location: { latitude: 1, longitude: 2 } },
    });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "LOCATION_DELETE" }) })
    );
  });
  it("does not treat a captioned photo as a textless post", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "no_text" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 74,
      message: { message_id: 74, chat: { id: "-200", type: "supergroup" }, from: { id: "20", first_name: "عضو" }, photo: [{ file_id: "p" }], caption: "توضیح" },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
  });
  it("answers /rules before the command lock could delete it", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "commands" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.db.guardChatText.findUnique.mockResolvedValue({ body: "قانون یک" });
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 60,
      message: { message_id: 60, chat: { id: "-200", type: "supergroup", title: "گروه" }, from: { id: "11", first_name: "عضو" }, text: "/rules" },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("sendMessage", expect.objectContaining({ chat_id: "-200", text: "قانون یک" }));
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
  });
  it("stays quiet when the rules text was never written", async () => {
    const group = chatRow({ id: "-200", rules: [] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.db.guardChatText.findUnique.mockResolvedValue(null);
    await handleUpdate({
      update_id: 61,
      message: { message_id: 61, chat: { id: "-200", type: "supergroup" }, from: { id: "11", first_name: "عضو" }, text: "/rules" },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
  });
  it("sends the welcome text when a join is actually observed", async () => {
    mocks.db.guardChat.findUnique.mockResolvedValue(chatRow({ id: "-200" }));
    mocks.db.guardChatText.findUnique.mockResolvedValue({ body: "سلام {user}" });
    mocks.db.guardMember.findUnique.mockResolvedValue(null);
    await handleUpdate({
      update_id: 62,
      chat_member: {
        chat: { id: "-200", type: "supergroup", title: "گروه" },
        date: 1_790_000_000,
        from: { id: "12", first_name: "نوید" },
        old_chat_member: { status: "left", user: { id: "12", first_name: "نوید" } },
        new_chat_member: { status: "member", user: { id: "12", first_name: "نوید" } },
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("sendMessage", expect.objectContaining({ text: "سلام نوید", disable_notification: true }));
  });
  it("does not welcome someone who was only promoted", async () => {
    mocks.db.guardChat.findUnique.mockResolvedValue(chatRow({ id: "-200" }));
    mocks.db.guardChatText.findUnique.mockResolvedValue({ body: "سلام {user}" });
    mocks.db.guardMember.findUnique.mockResolvedValue(null);
    await handleUpdate({
      update_id: 63,
      chat_member: {
        chat: { id: "-200", type: "supergroup", title: "گروه" },
        date: 1_790_000_000,
        from: { id: "12", first_name: "نوید" },
        old_chat_member: { status: "member", user: { id: "12", first_name: "نوید" } },
        new_chat_member: { status: "administrator", user: { id: "12", first_name: "نوید" } },
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
  });
  it("writes nothing to the counter table when no counting rule is on", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "links" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 50,
      message: { message_id: 50, chat: { id: "-200", type: "supergroup" }, from: { id: "10", first_name: "عضو" }, text: "سلام" },
    });
    expect(mocks.db.guardMessageLog.create).not.toHaveBeenCalled();
    expect(mocks.db.guardMessageLog.count).not.toHaveBeenCalled();
  });
  it("deletes a message once the sender is over the rate limit", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "message_rate", limitCount: 3, limitWindowMinutes: 5 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    mocks.db.guardMessageLog.count.mockResolvedValue(4);
    await handleUpdate({
      update_id: 51,
      message: { message_id: 51, chat: { id: "-200", type: "supergroup" }, from: { id: "10", first_name: "عضو" }, text: "باز هم" },
    });
    expect(mocks.db.guardMessageLog.create).toHaveBeenCalled();
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 51 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MESSAGE_RATE_DELETE" }) })
    );
  });
  it("leaves the message alone at exactly the limit, since the row for it is already counted", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "message_rate", limitCount: 3, limitWindowMinutes: 5 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    mocks.db.guardMessageLog.count.mockResolvedValue(3);
    await handleUpdate({
      update_id: 52,
      message: { message_id: 52, chat: { id: "-200", type: "supergroup" }, from: { id: "10", first_name: "عضو" }, text: "سومی" },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
  });
  it("prunes counter rows by age on every write", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "message_rate", limitCount: 3, limitWindowMinutes: 5 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 53,
      message: { message_id: 53, chat: { id: "-200", type: "supergroup" }, from: { id: "10", first_name: "عضو" }, text: "سلام" },
    });
    expect(mocks.db.guardMessageLog.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ chatId: "-200", userId: "10" }) })
    );
  });
  it("deletes a repeat once the same text passes its limit", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "duplicate_messages", limitCount: 2, limitWindowMinutes: 1440 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    mocks.db.guardMessageLog.count.mockResolvedValue(3);
    await handleUpdate({
      update_id: 54,
      message: { message_id: 54, chat: { id: "-200", type: "supergroup" }, from: { id: "10", first_name: "عضو" }, text: "تبلیغ" },
    });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "DUPLICATE_DELETE" }) })
    );
  });
  it("does not count a message with no text against the duplicate rule", async () => {
    const group = chatRow({ id: "-200", rules: [{ rule: "duplicate_messages", limitCount: 1, limitWindowMinutes: 60 }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    mocks.db.guardMessageLog.count.mockResolvedValue(9);
    await handleUpdate({
      update_id: 55,
      message: { message_id: 55, chat: { id: "-200", type: "supergroup" }, from: { id: "10", first_name: "عضو" }, sticker: { file_id: "s1" } },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
  });
  it("deletes messages containing hashtags sent by regular members when lockHashtags is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "hashtags" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 31,
      message: {
        message_id: 25,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "5", first_name: "عضو عادی" },
        text: "فروش ویژه #تخفیف_امروز",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 25 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chatId: "-200", action: "HASHTAG_DELETE" }) })
    );
  });
  it("leaves hashtags alone when only lockLinks is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "links" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 32,
      message: {
        message_id: 26,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "5", first_name: "عضو عادی" },
        text: "فروش ویژه #تخفیف_امروز",
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
  });
  it("deletes media messages sent by regular members when lockMedia is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "media" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 12,
      message: {
        message_id: 10,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "2", first_name: "عضو عادی" },
        photo: [{ file_id: "photo_123" }],
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 10 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chatId: "-200", action: "MEDIA_DELETE" }) })
    );
  });
  it("allows media messages sent by admins even when lockMedia is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "media" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator" });
    await handleUpdate({
      update_id: 13,
      message: {
        message_id: 11,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "3", first_name: "مدیر گروه" },
        photo: [{ file_id: "photo_admin" }],
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MEDIA_DELETE" }) })
    );
  });
  it("deletes forwarded messages sent by regular members when lockForwards is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "forwards" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({
      update_id: 14,
      message: {
        message_id: 12,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "2", first_name: "عضو عادی" },
        text: "پست فوروارد شده",
        forward_origin: { type: "channel", chat: { id: "-100", title: "کانال دیگر", type: "channel" } },
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 12 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ chatId: "-200", action: "FORWARD_DELETE" }) })
    );
  });
  it("allows forwarded messages sent by admins even when lockForwards is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "forwards" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator" });
    await handleUpdate({
      update_id: 15,
      message: {
        message_id: 13,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "3", first_name: "مدیر گروه" },
        text: "فوروارد معتبر مدیر",
        forward_origin: { type: "channel", chat: { id: "-100", title: "کانال دیگر", type: "channel" } },
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "FORWARD_DELETE" }) })
    );
  });
  it("allows automatic forwards from linked channel even when lockForwards is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "forwards" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    await handleUpdate({
      update_id: 16,
      message: {
        message_id: 14,
        chat: { id: "-200", type: "supergroup" },
        is_automatic_forward: true,
        text: "پست خودکار کانال",
        forward_origin: { type: "channel" },
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "FORWARD_DELETE" }) })
    );
  });
  it("deletes messages containing emoji when lockEmoji is enabled for non-admins", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "emoji" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member", user: { id: 10 } });
    await handleUpdate({
      update_id: 17,
      message: {
        message_id: 15,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "10", first_name: "عضو" },
        text: "سلام به همگی 😀",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 15 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chatId: "-200",
          targetId: "10",
          action: "EMOJI_DELETE",
          actorId: "system:emoji-lock",
        }),
      })
    );
  });
  it("exempts admins from emoji deletion when lockEmoji is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "emoji" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "administrator", user: { id: 10 } });
    await handleUpdate({
      update_id: 18,
      message: {
        message_id: 16,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "10", first_name: "مدیر" },
        text: "اعلامیه رسمی مدیر 📢",
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "EMOJI_DELETE" }) })
    );
  });
  it("deletes emoji-only spam when lockEmptyEmoji is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "empty_emoji" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member", user: { id: 10 } });
    await handleUpdate({
      update_id: 19,
      message: {
        message_id: 17,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "10", first_name: "عضو" },
        text: "🔥 🚀 🙌",
      },
    });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 17 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chatId: "-200",
          targetId: "10",
          action: "EMOJI_DELETE",
          actorId: "system:emoji-lock",
        }),
      })
    );
  });
  it("allows mixed text and emoji when only lockEmptyEmoji is enabled", async () => {
    const group = chatRow({ id: "-200", active: true, rules: [{ rule: "empty_emoji" }] });
    mocks.db.guardChat.findMany.mockResolvedValue([group]);
    mocks.getMember.mockResolvedValue({ status: "member", user: { id: 10 } });
    await handleUpdate({
      update_id: 20,
      message: {
        message_id: 18,
        chat: { id: "-200", type: "supergroup" },
        from: { id: "10", first_name: "عضو" },
        text: "سلام دوستان روزتون بخیر 🌸",
      },
    });
    expect(mocks.telegram).not.toHaveBeenCalledWith("deleteMessage", expect.anything());
    expect(mocks.db.guardEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "EMOJI_DELETE" }) })
    );
  });
  it("does not verify /start commands in public groups", async () => {
    mocks.db.guardChat.findFirst.mockResolvedValue(null);
    await handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: "-100", type: "supergroup" }, from: { id: "1", first_name: "عضو" }, text: "/start" } });
    expect(mocks.db.guardUser.upsert).not.toHaveBeenCalled();
  });
  it("verifies the sender only in a matching private chat", async () => {
    await handleUpdate({ update_id: 2, message: { message_id: 1, chat: { id: "1", type: "private" }, from: { id: "1", first_name: "عضو" }, text: "/start" } });
    expect(mocks.db.guardUser.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "1" }, create: expect.objectContaining({ verifiedAt: expect.any(Date) }) }));
  });
  it("ignores membership updates from unregistered chats", async () => {
    mocks.db.guardChat.findUnique.mockResolvedValue(null);
    const user = { id: "1", first_name: "عضو" };
    await handleUpdate({ update_id: 3, chat_member: { chat: { id: "-999", type: "channel" }, date: 100, from: user, old_chat_member: { status: "left", user }, new_chat_member: { status: "member", user } } });
    expect(mocks.db.guardUser.upsert).not.toHaveBeenCalled();
  });
  it("does not reprocess completed updates", async () => {
    mocks.db.guardUpdate.create.mockRejectedValue({ code: "P2002" });
    mocks.db.guardUpdate.findUnique.mockResolvedValue({ completed: true });
    await handleUpdate({ update_id: 4 });
    expect(mocks.db.guardUpdate.update).not.toHaveBeenCalled();
  });
  it("rejects callbacks forwarded to another chat before any membership query", async () => {
    mocks.db.guardPost.findUnique.mockResolvedValue({ id: "post1", chatId: "-100", messageId: 1, status: "SUCCEEDED", chat: { active: true } });
    await handleUpdate({ update_id: 5, callback_query: { id: "c1", from: { id: "1", first_name: "عضو" }, data: "v:post1:agree", message: { message_id: 1, chat: { id: "-200", type: "channel" } } } });
    expect(mocks.getMember).not.toHaveBeenCalled();
    expect(mocks.telegram).toHaveBeenCalledWith("answerCallbackQuery", expect.objectContaining({ callback_query_id: "c1", show_alert: true }));
  });
});
