import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Update } from "./input";

const mocks = vi.hoisted(() => ({
  db: {
    account: { findMany: vi.fn() },
    guardPost: { findUnique: vi.fn() },
    guardAlert: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
  tx: {
    guardChat: { findUniqueOrThrow: vi.fn() },
    guardUser: { upsert: vi.fn() },
    guardMember: { upsert: vi.fn(), update: vi.fn() },
    guardVote: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    guardAlert: { upsert: vi.fn() },
  },
  withChatLock: vi.fn(),
  refreshKeyboard: vi.fn(),
  getMember: vi.fn(),
  telegram: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./store", () => ({ withChatLock: mocks.withChatLock, refreshKeyboard: mocks.refreshKeyboard }));
vi.mock("./telegram", () => ({
  getMember: mocks.getMember,
  telegram: mocks.telegram,
  TelegramError: class extends Error {},
}));

import { handleVote } from "./votes";

const now = new Date("2026-09-18T12:00:00.000Z");
const chatId = "-100123";
const postId = "post_1";
const userId = "123";
const adminId = "999";
const chat = { id: chatId, active: true, verification: true, waitHours: 24, title: "گروه آزمایش" };
const member = { chatId, userId, banned: false, present: true, joinedAt: null, firstVotedAt: null };

function callback(choice = "agree"): NonNullable<Update["callback_query"]> {
  return {
    id: "callback-1",
    from: { id: userId, first_name: "عضو" },
    data: `v:${postId}:${choice}`,
    message: { message_id: 42, chat: { id: chatId, type: "supergroup" } },
  };
}

function pendingAlert() {
  return {
    id: "alert-1", chatId, postId, notifiedAt: null,
    chat: { ...chat, admins: [{ userId: adminId }] },
  };
}

function expectDenied() {
  expect(mocks.tx.guardVote.upsert).not.toHaveBeenCalled();
  expect(mocks.tx.guardMember.update).not.toHaveBeenCalled();
  expect(mocks.refreshKeyboard).not.toHaveBeenCalled();
  expect(mocks.telegram).toHaveBeenCalledWith("answerCallbackQuery", expect.objectContaining({ callback_query_id: "callback-1", show_alert: true }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("GUARD_ADMIN_IDS", adminId);
  vi.stubEnv("GUARD_BOT_USERNAME", "TestGuardBot");
  vi.stubEnv("APP_URL", "https://guard.example");
  mocks.db.guardPost.findUnique.mockResolvedValue({ id: postId, chatId, messageId: 42, status: "SUCCEEDED", chat });
  mocks.db.guardAlert.findUnique.mockResolvedValue(null);
  mocks.db.guardAlert.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.account.findMany.mockResolvedValue([{ id: adminId }]);
  mocks.tx.guardChat.findUniqueOrThrow.mockResolvedValue(chat);
  mocks.tx.guardUser.upsert.mockResolvedValue({ id: userId, verifiedAt: new Date(now.getTime() - 86_400_000) });
  mocks.tx.guardMember.upsert.mockResolvedValue({ ...member });
  mocks.tx.guardVote.findUnique.mockResolvedValue(null);
  mocks.tx.guardVote.findMany.mockResolvedValue([]);
  mocks.withChatLock.mockImplementation(async (_chatId: string, task: (tx: typeof mocks.tx) => Promise<unknown>) => task(mocks.tx));
  mocks.getMember.mockResolvedValue({ status: "member", user: { id: Number(userId), first_name: "عضو" } });
  mocks.telegram.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("handleVote persistence", () => {
  it.each(["agree", "useful", "question"])("records one %s vote using the real callback protocol", async (choice) => {
    await handleVote(callback(choice));
    expect(mocks.getMember).toHaveBeenCalledWith(chatId, userId);
    expect(mocks.withChatLock).toHaveBeenCalledWith(chatId, expect.any(Function));
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, choice, first: true, createdAt: now },
      update: { choice },
    });
    expect(mocks.tx.guardMember.update).toHaveBeenCalledExactlyOnceWith({
      where: { chatId_userId: { chatId, userId } }, data: { firstVotedAt: now },
    });
    expect(mocks.refreshKeyboard).toHaveBeenCalledExactlyOnceWith(mocks.tx, postId);
    expect(mocks.telegram).toHaveBeenCalledWith("answerCallbackQuery", expect.objectContaining({ show_alert: false }));
  });

  it("allows unknown join dates without inventing a join date from a callback", async () => {
    await handleVote(callback());
    expect(mocks.tx.guardMember.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { chatId_userId: { chatId, userId } },
      create: { chatId, userId, present: true },
      update: {},
    });
    expect(mocks.tx.guardMember.update).toHaveBeenCalledWith(expect.objectContaining({ data: { firstVotedAt: now } }));
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledOnce();
  });

  it.each([true, false])("preserves the original first=%s and createdAt when switching choices", async (first) => {
    const original = new Date(now.getTime() - 60_000);
    mocks.tx.guardMember.upsert.mockResolvedValue({ ...member, firstVotedAt: original });
    mocks.tx.guardVote.findUnique.mockResolvedValue({ postId, userId, choice: "agree", first, createdAt: original, updatedAt: original });
    await handleVote(callback("question"));
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, choice: "question", first: false, createdAt: now },
      update: { choice: "question" },
    });
    expect(mocks.tx.guardMember.update).not.toHaveBeenCalled();
  });

  it("does not count a user's later post as their first vote in the chat", async () => {
    mocks.tx.guardMember.upsert.mockResolvedValue({ ...member, firstVotedAt: new Date(now.getTime() - 86_400_000) });
    await handleVote(callback());
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ first: false }) }));
    expect(mocks.tx.guardMember.update).not.toHaveBeenCalled();
  });
});

describe("handleVote live gates", () => {
  it("blocks an observed member who joined less than 24 hours ago", async () => {
    mocks.tx.guardMember.upsert.mockResolvedValue({ ...member, joinedAt: new Date(now.getTime() - 23 * 3_600_000) });
    await handleVote(callback());
    expectDenied();
  });

  it("allows an observed member at the exact 24-hour boundary", async () => {
    mocks.tx.guardMember.upsert.mockResolvedValue({ ...member, joinedAt: new Date(now.getTime() - 24 * 3_600_000) });
    await handleVote(callback());
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledOnce();
  });

  it("rechecks private verification and blocks a revoked user on the next callback", async () => {
    await handleVote(callback());
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledOnce();
    mocks.tx.guardVote.upsert.mockClear();
    mocks.tx.guardMember.update.mockClear();
    mocks.refreshKeyboard.mockClear();
    mocks.telegram.mockClear();
    mocks.tx.guardUser.upsert.mockResolvedValue({ id: userId, verifiedAt: null });
    await handleVote(callback("useful"));
    expectDenied();
    expect(mocks.tx.guardUser.upsert).toHaveBeenCalledTimes(2);
  });

  it("allows an unverified member only when verification is disabled in the locked chat", async () => {
    mocks.tx.guardChat.findUniqueOrThrow.mockResolvedValue({ ...chat, verification: false });
    mocks.tx.guardUser.upsert.mockResolvedValue({ id: userId, verifiedAt: null });
    await handleVote(callback());
    expect(mocks.tx.guardVote.upsert).toHaveBeenCalledOnce();
  });

  it.each(["left", "kicked"])("rejects live Telegram status %s even if cached membership is present", async (status) => {
    mocks.getMember.mockResolvedValue({ status });
    await handleVote(callback());
    expectDenied();
  });

  it("rejects a locally banned member even when Telegram reports membership", async () => {
    mocks.tx.guardMember.upsert.mockResolvedValue({ ...member, banned: true });
    await handleVote(callback());
    expectDenied();
  });

  it("rechecks whether the chat was disabled after the initial post lookup", async () => {
    mocks.tx.guardChat.findUniqueOrThrow.mockResolvedValue({ ...chat, active: false });
    await handleVote(callback());
    expectDenied();
    expect(mocks.tx.guardUser.upsert).not.toHaveBeenCalled();
  });
});

describe("handleVote evidence snapshots", () => {
  it("tells the voter the post is unconfirmed, instead of calling the button invalid", async () => {
    mocks.db.guardPost.findUnique.mockResolvedValue({ id: postId, chatId, messageId: null, status: "UNKNOWN", chat });
    await handleVote(callback());
    expect(mocks.getMember).not.toHaveBeenCalled();
    expect(mocks.telegram).toHaveBeenCalledExactlyOnceWith("answerCallbackQuery", expect.objectContaining({
      callback_query_id: "callback-1", show_alert: true, text: expect.stringContaining("شناسه‌ی این پیام"),
    }));
  });

  it("keeps the generic refusal for a button pressed on another chat's message", async () => {
    mocks.db.guardPost.findUnique.mockResolvedValue({ id: postId, chatId: "-100999", messageId: 42, status: "SUCCEEDED", chat });
    await handleVote(callback());
    expect(mocks.telegram).toHaveBeenCalledExactlyOnceWith("answerCallbackQuery", expect.objectContaining({
      text: "این دکمه برای این پیام معتبر نیست.",
    }));
  });

  it("snapshots five first voters with original timestamps and never overwrites a per-post alert", async () => {
    const recent = Array.from({ length: 5 }, (_, index) => ({ userId: String(100 + index), first: true, createdAt: new Date(now.getTime() - index * 10_000) }));
    mocks.tx.guardVote.findMany.mockResolvedValue([
      ...recent,
      { userId: "200", first: false, createdAt: now },
      { userId: "201", first: true, createdAt: new Date(now.getTime() - 90_001) },
      { userId: "202", first: true, createdAt: new Date(now.getTime() + 1) },
    ]);
    await handleVote(callback());
    const snapshot = {
      where: { postId },
      create: { chatId, postId, candidates: recent.map(({ userId, createdAt }) => ({ userId, firstVotedAt: createdAt.toISOString() })) },
      update: {},
    };
    expect(mocks.tx.guardAlert.upsert).toHaveBeenCalledExactlyOnceWith(snapshot);
    expect(mocks.tx.guardVote.findMany).toHaveBeenCalledWith({ where: { postId, first: true, createdAt: { gte: new Date(now.getTime() - 90_000) } } });
    await handleVote(callback("useful"));
    expect(mocks.tx.guardAlert.upsert).toHaveBeenNthCalledWith(2, snapshot);
  });

  it("does not create an alert for fewer than five distinct first voters", async () => {
    const recent = Array.from({ length: 4 }, (_, index) => ({ userId: String(100 + index), first: true, createdAt: now }));
    mocks.tx.guardVote.findMany.mockResolvedValue([...recent, recent[0]]);
    await handleVote(callback());
    expect(mocks.tx.guardAlert.upsert).not.toHaveBeenCalled();
  });
});

describe("handleVote alert notification authorization", () => {
  it.each(["member", "left", "kicked", "restricted"])("does not notify a cached admin whose fresh status is %s", async (status) => {
    mocks.db.guardAlert.findUnique.mockResolvedValue(pendingAlert());
    mocks.getMember.mockImplementation(async (_chatId: string, id: string) => ({ status: id === adminId ? status : "member" }));
    await handleVote(callback());
    expect(mocks.getMember).toHaveBeenCalledWith(chatId, adminId);
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
    expect(mocks.db.guardAlert.updateMany).not.toHaveBeenCalled();
  });

  it.each(["administrator", "creator"])("notifies the chat's registered owner only after fresh %s verification", async (status) => {
    mocks.db.guardAlert.findUnique.mockResolvedValue(pendingAlert());
    mocks.getMember.mockImplementation(async (_chatId: string, id: string) => ({ status: id === adminId ? status : "member" }));
    await handleVote(callback());
    expect(mocks.getMember).toHaveBeenCalledWith(chatId, adminId);
    expect(mocks.db.guardAlert.updateMany).toHaveBeenCalledWith({ where: { id: "alert-1", notifiedAt: null }, data: { notifiedAt: now } });
    expect(mocks.telegram).toHaveBeenCalledWith("sendMessage", expect.objectContaining({ chat_id: adminId, reply_markup: { inline_keyboard: [[expect.objectContaining({ url: `https://guard.example/fa/portal?chat=${encodeURIComponent(chatId)}&view=alerts` })]] } }));
    const membershipCallIndex = mocks.getMember.mock.calls.findIndex(([, id]) => id === adminId);
    const sendCallIndex = mocks.telegram.mock.calls.findIndex(([method]) => method === "sendMessage");
    expect(mocks.getMember.mock.invocationCallOrder[membershipCallIndex]).toBeLessThan(mocks.telegram.mock.invocationCallOrder[sendCallIndex]);
  });

  it("notifies an owner who is not on the platform allowlist", async () => {
    vi.stubEnv("GUARD_ADMIN_IDS", "");
    mocks.db.guardAlert.findUnique.mockResolvedValue(pendingAlert());
    mocks.getMember.mockImplementation(async (_chatId: string, id: string) => ({ status: id === adminId ? "administrator" : "member" }));
    await handleVote(callback());
    expect(mocks.telegram).toHaveBeenCalledWith("sendMessage", expect.objectContaining({ chat_id: adminId }));
  });

  it("does not notify an owner whose account is suspended or gone", async () => {
    mocks.db.guardAlert.findUnique.mockResolvedValue(pendingAlert());
    mocks.db.account.findMany.mockResolvedValue([]);
    await handleVote(callback());
    expect(mocks.getMember).not.toHaveBeenCalledWith(chatId, adminId);
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
    expect(mocks.db.guardAlert.updateMany).not.toHaveBeenCalled();
  });

  it("reaches the remaining owners when one is unreachable, and claims the alert once", async () => {
    const second = "777";
    mocks.db.guardAlert.findUnique.mockResolvedValue({ ...pendingAlert(), chat: { ...chat, admins: [{ userId: adminId }, { userId: second }] } });
    mocks.db.account.findMany.mockResolvedValue([{ id: adminId }, { id: second }]);
    mocks.getMember.mockImplementation(async (_chatId: string, id: string) => {
      if (id === adminId) throw new Error("telegram down");
      return { status: id === second ? "administrator" : "member" };
    });
    await handleVote(callback());
    expect(mocks.telegram).toHaveBeenCalledWith("sendMessage", expect.objectContaining({ chat_id: second }));
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.objectContaining({ chat_id: adminId }));
    expect(mocks.db.guardAlert.updateMany).toHaveBeenCalledOnce();
  });

  it("does not notify twice when another worker already claimed the alert", async () => {
    mocks.db.guardAlert.findUnique.mockResolvedValue(pendingAlert());
    mocks.getMember.mockImplementation(async (_chatId: string, id: string) => ({ status: id === adminId ? "administrator" : "member" }));
    mocks.db.guardAlert.updateMany.mockResolvedValue({ count: 0 });
    await handleVote(callback());
    expect(mocks.telegram).not.toHaveBeenCalledWith("sendMessage", expect.anything());
  });
});
