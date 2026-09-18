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
    const group = { id: "-200", waitHours: 0, verification: false };
    const channel = { id: "-100", waitHours: 24, verification: false };
    mocks.db.guardChat.findFirst.mockResolvedValue(group);
    mocks.db.guardChat.findMany.mockResolvedValue([group, channel]);
    mocks.db.guardMember.findUnique.mockResolvedValue({ joinedAt: new Date() });
    mocks.getMember.mockResolvedValue({ status: "member" });
    await handleUpdate({ update_id: 6, message: { message_id: 4, chat: { id: "-200", type: "supergroup" }, from: { id: "1", first_name: "عضو" }, text: "دیدگاه" } });
    expect(mocks.telegram).toHaveBeenCalledWith("deleteMessage", { chat_id: "-200", message_id: 4 });
    expect(mocks.db.guardEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ chatId: "-100", action: "COMMENT_DELETE" }) }));
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
