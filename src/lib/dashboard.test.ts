import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    account: { findUnique: vi.fn() },
    guardChat: { findMany: vi.fn(), findFirst: vi.fn() },
    guardMember: { findMany: vi.fn(), count: vi.fn() },
    guardPost: { findMany: vi.fn(), count: vi.fn() },
    guardAlert: { findMany: vi.fn(), count: vi.fn() },
    guardEvent: { findMany: vi.fn() },
    guardVote: { groupBy: vi.fn() },
  },
  getMember: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/channel-guard/telegram", () => ({ getMember: mocks.getMember, botId: () => "99" }));

import { candidateIds, dashboardHref, loadDashboard, parseView, sampleDashboard, type Chat } from "./dashboard";

const adminId = "11";
const chat: Chat = {
  id: "-100123", title: "کانال آزمون", type: "channel", username: null, active: true,
  waitHours: 24, verification: true, commentGate: false, deleteJoinMessages: false, lockCommands: false, lockLinks: false, lockMedia: false, discussionChatId: null,
};
const scope = { admins: { some: { userId: adminId } } };
const where = { chatId: chat.id, chat: scope };
const privateQueries = () => [
  mocks.db.guardMember.findMany, mocks.db.guardMember.count,
  mocks.db.guardPost.findMany, mocks.db.guardPost.count,
  mocks.db.guardAlert.findMany, mocks.db.guardAlert.count,
  mocks.db.guardEvent.findMany, mocks.db.guardVote.groupBy,
];
function expectNoPrivateQueries() {
  for (const query of privateQueries()) expect(query).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GUARD_ADMIN_IDS", adminId);
  mocks.db.account.findUnique.mockResolvedValue({ id: adminId, status: "ACTIVE" });
  mocks.db.guardChat.findMany.mockResolvedValue([chat]);
  mocks.db.guardChat.findFirst.mockResolvedValue(chat);
  mocks.getMember.mockResolvedValue({ status: "administrator", user: { id: Number(adminId) } });
  mocks.db.guardMember.findMany.mockResolvedValue([]);
  mocks.db.guardMember.count.mockResolvedValue(0);
  mocks.db.guardPost.findMany.mockResolvedValue([]);
  mocks.db.guardPost.count.mockResolvedValue(0);
  mocks.db.guardAlert.findMany.mockResolvedValue([]);
  mocks.db.guardAlert.count.mockResolvedValue(0);
  mocks.db.guardEvent.findMany.mockResolvedValue([]);
  mocks.db.guardVote.groupBy.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("dashboard authorization and scope", () => {
  it("scopes the selected chat and all private lists and counts to the administrator", async () => {
    await loadDashboard(adminId, chat.id);
    expect(mocks.db.guardChat.findMany).toHaveBeenCalledWith({ where: scope, orderBy: { createdAt: "desc" }, take: 50 });
    expect(mocks.db.guardChat.findFirst).toHaveBeenCalledWith({ where: { id: chat.id, ...scope } });
    expect(mocks.getMember).toHaveBeenCalledWith(chat.id, adminId);
    expect(mocks.db.guardMember.findMany).toHaveBeenCalledWith({
      where, orderBy: [{ joinedAt: { sort: "desc", nulls: "last" } }, { userId: "desc" }], take: 50, include: { user: true },
    });
    expect(mocks.db.guardMember.findMany).toHaveBeenCalledWith({ where: { ...where, banned: true }, select: { userId: true } });
    expect(mocks.db.guardPost.findMany).toHaveBeenCalledWith({ where, orderBy: { createdAt: "desc" }, take: 50 });
    expect(mocks.db.guardAlert.findMany).toHaveBeenCalledWith({
      where: { ...where, reviewedAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { post: { select: { text: true } } },
    });
    expect(mocks.db.guardEvent.findMany).toHaveBeenCalledWith({ where, orderBy: { createdAt: "desc" }, take: 50 });
    expect(mocks.db.guardMember.count).toHaveBeenCalledWith({ where });
    expect(mocks.db.guardPost.count).toHaveBeenCalledWith({ where });
    expect(mocks.db.guardAlert.count).toHaveBeenCalledWith({ where: { ...where, reviewedAt: null } });
    for (const query of privateQueries().filter((query) => query.mock.calls.length)) {
      expect(query.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.getMember.mock.invocationCallOrder[0]);
    }
  });

  it("does not load another chat or fall back to an owned chat for an unauthorized selection", async () => {
    mocks.db.guardChat.findFirst.mockResolvedValue(null);
    const result = await loadDashboard(adminId, "-100999");
    expect(mocks.db.guardChat.findFirst).toHaveBeenCalledWith({ where: { id: "-100999", ...scope } });
    expect(result.chat).toBeNull();
    expect(result.unavailableChat).toBe(true);
    expect(result.members).toEqual([]);
    expect(result.posts).toEqual([]);
    expect(result.alerts).toEqual([]);
    expect(result.events).toEqual([]);
    expect(mocks.getMember).not.toHaveBeenCalled();
    expectNoPrivateQueries();
  });

  it("does not query private data when no granted chat exists", async () => {
    mocks.db.guardChat.findMany.mockResolvedValue([]);
    const result = await loadDashboard(adminId);
    expect(result.chat).toBeNull();
    expect(result.unavailableChat).toBe(false);
    expect(mocks.db.guardChat.findFirst).not.toHaveBeenCalled();
    expect(mocks.getMember).not.toHaveBeenCalled();
    expectNoPrivateQueries();
  });

  it.each([undefined, chat.id])("checks live permissions for default and explicit selection %s", async (requestedChat) => {
    await loadDashboard(adminId, requestedChat);
    expect(mocks.getMember).toHaveBeenCalledExactlyOnceWith(chat.id, adminId);
  });

  it.each(["member", "left", "kicked", "restricted"])("rejects a revoked administrator with Telegram status %s before private queries", async (status) => {
    mocks.getMember.mockResolvedValue({ status, user: { id: Number(adminId) } });
    await expect(loadDashboard(adminId, chat.id)).rejects.toMatchObject({ status: 403 });
    expectNoPrivateQueries();
  });

  it("allows registered customers outside the platform allowlist", async () => {
    vi.stubEnv("GUARD_ADMIN_IDS", "22");
    expect((await loadDashboard(adminId, chat.id)).chat?.id).toBe(chat.id);
  });

  it("rejects suspended customers despite a stored chat grant", async () => {
    mocks.db.account.findUnique.mockResolvedValue({ id: adminId, status: "SUSPENDED" });
    await expect(loadDashboard(adminId, chat.id)).rejects.toMatchObject({ status: 403 });
    expect(mocks.getMember).not.toHaveBeenCalled();
    expectNoPrivateQueries();
  });

  it("does not fetch private data while the live permission check is pending", async () => {
    let resolvePermission!: (value: { status: string; user: { id: number } }) => void;
    mocks.getMember.mockImplementation(() => new Promise((resolve) => { resolvePermission = resolve; }));
    const result = loadDashboard(adminId, chat.id);
    await vi.waitFor(() => expect(mocks.getMember).toHaveBeenCalledOnce());
    expectNoPrivateQueries();
    resolvePermission({ status: "administrator", user: { id: Number(adminId) } });
    await result;
    expect(mocks.db.guardMember.findMany).toHaveBeenCalled();
  });

  it("propagates Telegram outages instead of returning empty statistics", async () => {
    const failure = new Error("Telegram unavailable");
    mocks.getMember.mockRejectedValue(failure);
    await expect(loadDashboard(adminId, chat.id)).rejects.toBe(failure);
    expectNoPrivateQueries();
  });

  it("propagates database failures instead of returning empty statistics", async () => {
    const failure = new Error("Database unavailable");
    mocks.db.guardPost.findMany.mockRejectedValue(failure);
    await expect(loadDashboard(adminId, chat.id)).rejects.toBe(failure);
    expect(mocks.db.guardVote.groupBy).not.toHaveBeenCalled();
  });

  it("excludes all banned IDs beyond the displayed member page from scoped vote counts", async () => {
    const banned = Array.from({ length: 61 }, (_, index) => ({ userId: String(index + 100) }));
    mocks.db.guardMember.findMany.mockImplementation(async (query: { where: { banned?: boolean } }) => query.where.banned ? banned : []);
    mocks.db.guardPost.findMany.mockResolvedValue([{ id: "post-1", text: "متن آزمون", status: "SUCCEEDED", messageId: 1, createdAt: new Date("2026-09-18T08:00:00Z") }]);
    mocks.db.guardPost.count.mockResolvedValue(1);
    mocks.db.guardVote.groupBy.mockResolvedValue([{ postId: "post-1", choice: "agree", _count: { _all: 2 } }]);
    const result = await loadDashboard(adminId, chat.id);
    expect(mocks.db.guardVote.groupBy).toHaveBeenCalledWith({
      by: ["postId", "choice"],
      where: {
        postId: { in: ["post-1"] }, userId: { notIn: banned.map((member) => member.userId) },
        choice: { in: ["agree", "useful", "question"] }, post: { chatId: chat.id, chat: scope },
      },
      _count: { _all: true },
    });
    expect(result.posts[0].votes).toEqual({ agree: 2, useful: 0, question: 0 });
    expect(mocks.db.guardMember.findMany).toHaveBeenCalledWith({ where: { ...where, banned: true }, select: { userId: true } });
  });
});

describe("dashboard sample and navigation", () => {
  it("uses five matching first-time voters without querying live services", () => {
    const data = sampleDashboard();
    const voters = data.members.filter((member) => member.firstVotedAt && !member.banned);
    expect(voters).toHaveLength(5);
    expect(candidateIds(data.alerts[0].candidates)).toEqual(voters.map((member) => member.userId));
    expect(data.alerts[0].candidates).toEqual(voters.map((member) => ({ userId: member.userId, firstVotedAt: member.firstVotedAt })));
    expect(data.counts).toEqual({ members: data.members.length, posts: data.posts.length, alerts: data.alerts.length });
    expect(Object.values(data.posts[0].votes).reduce((total, value) => total + value, 0)).toBe(voters.length);
    for (const voter of voters) {
      expect(voter.verifiedAt).not.toBeNull();
      expect(new Date(voter.firstVotedAt!).getTime() - new Date(voter.joinedAt!).getTime()).toBeGreaterThanOrEqual(data.chat!.waitHours * 3_600_000);
    }
    expect(mocks.db.guardChat.findMany).not.toHaveBeenCalled();
    expect(mocks.getMember).not.toHaveBeenCalled();
    expectNoPrivateQueries();
  });

  it("validates views and keeps preview navigation separate", () => {
    expect(parseView("settings")).toBe("settings");
    expect(parseView("invalid")).toBe("overview");
    expect(parseView(["alerts"])).toBe("overview");
    expect(dashboardHref("alerts", chat.id, true)).toBe("/preview?view=alerts&chat=-100123");
    expect(dashboardHref("members", chat.id)).toBe("/?view=members&chat=-100123");
  });

  it("bounds and deduplicates actionable evidence IDs", () => {
    expect(candidateIds([{ userId: "123" }, { userId: "123" }, { userId: "-7" }, { userId: "bad" }, "456"])).toEqual(["123", "456"]);
    expect(candidateIds(Array.from({ length: 60 }, (_, index) => String(index + 1)))).toHaveLength(50);
    expect(candidateIds(null)).toEqual([]);
  });
});
