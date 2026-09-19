import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: { guardUpdate: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, guardChat: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() }, guardUser: { upsert: vi.fn() }, guardPost: { findUnique: vi.fn() }, guardMember: { findUnique: vi.fn() }, guardEvent: { create: vi.fn(), update: vi.fn() } },
  telegram: vi.fn(), getMember: vi.fn(), moderateMember: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./telegram", () => ({ telegram: mocks.telegram, getMember: mocks.getMember, botId: () => "999", TelegramError: class extends Error {} }));
vi.mock("./actions", () => ({ moderateMember: mocks.moderateMember }));
import { handleUpdate } from "./guard";

beforeEach(() => { vi.resetAllMocks(); mocks.db.guardUpdate.create.mockResolvedValue({}); mocks.db.guardUpdate.update.mockResolvedValue({}); mocks.db.guardChat.findMany.mockResolvedValue([]); mocks.telegram.mockResolvedValue(true); });
describe("webhook behavior", () => {
  it("checks both group and linked-channel waiting rules before accepting a comment", async () => {
    const group = { id: "-200", waitHours: 0, verification: false, commentGate: true };
    const channel = { id: "-100", waitHours: 24, verification: false, commentGate: true };
    mocks.db.guardChat.findFirst.mockResolvedValue(group);
    mocks.db.guardChat.findMany.mockResolvedValue([group, channel]);
    mocks.db.guardMember.findUnique.mockResolvedValue({ joinedAt: new Date() });
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({ update_id: 6, message: { message_id: 4, chat: { id: "-200", type: "supergroup" }, from: { id: "1", first_name: "عضو" }, text: "دیدگاه" } });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 4 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ chatId: "-100", action: "COMMENT_DELETE" }) }));
  });
  it("deletes join and leave service messages when deleteJoinMessages is enabled", async () => {
    const group = { id: "-200", deleteJoinMessages: true, active: true };
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
    const group = { id: "-200", lockCommands: true, active: true };
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
    const group = { id: "-200", lockCommands: true, active: true };
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
    const group = { id: "-200", active: true, lockLinks: true, lockMedia: true, lockForwards: true, lockEmoji: true, commentGate: true };
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
    const group = { id: "-200", lockLinks: true, active: true };
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
    const group = { id: "-200", lockLinks: true, active: true };
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
  it("deletes media messages sent by regular members when lockMedia is enabled", async () => {
    const group = { id: "-200", lockMedia: true, active: true };
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
    const group = { id: "-200", lockMedia: true, active: true };
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
    const group = { id: "-200", lockForwards: true, active: true };
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
    const group = { id: "-200", lockForwards: true, active: true };
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
    const group = { id: "-200", lockForwards: true, active: true };
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
    const group = { id: "-200", lockEmoji: true, active: true };
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
    const group = { id: "-200", lockEmoji: true, active: true };
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
    const group = { id: "-200", lockEmoji: false, lockEmptyEmoji: true, active: true };
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
    const group = { id: "-200", lockEmoji: false, lockEmptyEmoji: true, active: true };
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
