export const views = ["overview", "posts", "members", "alerts", "events", "settings"] as const;
export type View = (typeof views)[number];
export type Chat = {
  id: string; title: string; type: string; username: string | null; active: boolean;
  waitHours: number; verification: boolean; commentGate: boolean; discussionChatId: string | null;
};
export type DashboardData = {
  chats: Chat[];
  chat: Chat | null;
  unavailableChat: boolean;
  counts: { members: number; posts: number; alerts: number };
  members: { userId: string; name: string; joinedAt: string | null; verifiedAt: string | null; firstVotedAt: string | null; banned: boolean; present: boolean }[];
  posts: { id: string; text: string; status: string; messageId: number | null; createdAt: string; votes: { agree: number; useful: number; question: number } }[];
  alerts: { id: string; postId: string; text: string; createdAt: string; candidates: unknown }[];
  events: { id: string; action: string; status: string; actorId: string; targetId: string | null; reason: string; detail: string | null; createdAt: string }[];
};
export const viewLabels: Record<View, string> = {
  overview: "نمای کلی", posts: "پست‌ها", members: "اعضای ثبت‌شده", alerts: "هشدارها", events: "گزارش عملیات", settings: "تنظیمات",
};
export function parseView(value: string | string[] | undefined): View {
  return views.includes(value as View) ? value as View : "overview";
}
export function number(value: number) { return new Intl.NumberFormat("fa-IR").format(value); }
export function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value)) : "ثبت نشده";
}
export function dashboardHref(view: View, chatId?: string, preview = false) {
  const params = new URLSearchParams({ view });
  if (chatId) params.set("chat", chatId);
  return `${preview ? "/preview" : "/"}?${params}`;
}
export function candidateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((candidate) => {
    const id = typeof candidate === "string" ? candidate : candidate && typeof candidate === "object" && "userId" in candidate ? String(candidate.userId) : "";
    return /^[1-9]\d{0,15}$/.test(id) ? [id] : [];
  }))].slice(0, 50);
}
export async function loadDashboard(adminId: string, requestedChat?: string): Promise<DashboardData> {
  const { db } = await import("@/lib/db");
  const scope = { admins: { some: { userId: adminId } } };
  const chats = await db.guardChat.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 50 });
  const chat = requestedChat
    ? await db.guardChat.findFirst({ where: { id: requestedChat, ...scope } })
    : chats[0] ?? null;
  const empty: DashboardData = { chats, chat, unavailableChat: Boolean(requestedChat && !chat), counts: { members: 0, posts: 0, alerts: 0 }, members: [], posts: [], alerts: [], events: [] };
  if (!chat) return empty;
  const { assertTelegramAdmin } = await import("@/lib/channel-guard/access");
  await assertTelegramAdmin(chat.id, adminId);
  const where = { chatId: chat.id, chat: scope };
  const [members, posts, alerts, events, memberCount, postCount, alertCount, bannedMembers] = await Promise.all([
    db.guardMember.findMany({ where, orderBy: [{ joinedAt: { sort: "desc", nulls: "last" } }, { userId: "desc" }], take: 50, include: { user: true } }),
    db.guardPost.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
    db.guardAlert.findMany({ where: { ...where, reviewedAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { post: { select: { text: true } } } }),
    db.guardEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
    db.guardMember.count({ where }),
    db.guardPost.count({ where }),
    db.guardAlert.count({ where: { ...where, reviewedAt: null } }),
    db.guardMember.findMany({ where: { ...where, banned: true }, select: { userId: true } }),
  ]);
  const votes = posts.length ? await db.guardVote.groupBy({
    by: ["postId", "choice"],
    where: { postId: { in: posts.map((post) => post.id) }, userId: { notIn: bannedMembers.map((member) => member.userId) }, choice: { in: ["agree", "useful", "question"] }, post: { chatId: chat.id, chat: scope } },
    _count: { _all: true },
  }) : [];
  return {
    ...empty,
    counts: { members: memberCount, posts: postCount, alerts: alertCount },
    members: members.map((member) => ({ userId: member.userId, name: member.user.name, joinedAt: member.joinedAt?.toISOString() ?? null, verifiedAt: member.user.verifiedAt?.toISOString() ?? null, firstVotedAt: member.firstVotedAt?.toISOString() ?? null, banned: member.banned, present: member.present })),
    posts: posts.map((post) => ({ id: post.id, text: post.text, status: post.status, messageId: post.messageId, createdAt: post.createdAt.toISOString(), votes: {
      agree: votes.find((vote) => vote.postId === post.id && vote.choice === "agree")?._count._all ?? 0,
      useful: votes.find((vote) => vote.postId === post.id && vote.choice === "useful")?._count._all ?? 0,
      question: votes.find((vote) => vote.postId === post.id && vote.choice === "question")?._count._all ?? 0,
    } })),
    alerts: alerts.map((alert) => ({ id: alert.id, postId: alert.postId, text: alert.post.text, createdAt: alert.createdAt.toISOString(), candidates: alert.candidates })),
    events: events.map((event) => ({ id: event.id, action: event.action, status: event.status, actorId: event.actorId, targetId: event.targetId, reason: event.reason, detail: event.detail, createdAt: event.createdAt.toISOString() })),
  };
}
export function sampleDashboard(): DashboardData {
  const chat: Chat = { id: "-100000000001", title: "کانال نمونهٔ گفتگو", type: "channel", username: null, active: true, waitHours: 24, verification: true, commentGate: true, discussionChatId: "-100000000002" };
  const members: DashboardData["members"] = [
    { userId: "900000001", name: "کاربر نمونهٔ اول", joinedAt: "2026-09-17T08:00:00Z", verifiedAt: "2026-09-17T08:10:00Z", firstVotedAt: "2026-09-18T09:00:00Z", banned: false, present: true },
    { userId: "900000002", name: "کاربر نمونهٔ دوم", joinedAt: "2026-09-17T07:00:00Z", verifiedAt: "2026-09-17T07:10:00Z", firstVotedAt: "2026-09-18T09:00:03Z", banned: false, present: true },
    { userId: "900000003", name: "کاربر نمونهٔ سوم", joinedAt: "2026-09-17T06:00:00Z", verifiedAt: "2026-09-17T06:10:00Z", firstVotedAt: "2026-09-18T09:00:06Z", banned: false, present: true },
    { userId: "900000004", name: "کاربر نمونهٔ چهارم", joinedAt: "2026-09-17T05:00:00Z", verifiedAt: "2026-09-17T05:10:00Z", firstVotedAt: "2026-09-18T09:00:09Z", banned: false, present: true },
    { userId: "900000005", name: "کاربر نمونهٔ پنجم", joinedAt: "2026-09-17T04:00:00Z", verifiedAt: "2026-09-17T04:10:00Z", firstVotedAt: "2026-09-18T09:00:12Z", banned: false, present: true },
    { userId: "900000006", name: "کاربر نمونهٔ ششم", joinedAt: "2026-09-16T07:00:00Z", verifiedAt: null, firstVotedAt: null, banned: true, present: false },
  ];
  return {
    chats: [chat], chat, unavailableChat: false,
    counts: { members: members.length, posts: 2, alerts: 1 },
    members,
    posts: [
      { id: "sample-post-1", text: "به گفتگوی این هفته خوش آمدید. کدام بخش از راهنمای عضویت به توضیح بیشتری نیاز دارد؟ نظر خود را با دکمه‌های زیر ثبت کنید.", status: "SUCCEEDED", messageId: 42, createdAt: "2026-09-18T08:30:00Z", votes: { agree: 3, useful: 1, question: 1 } },
      { id: "sample-post-2", text: "راهنمای تازهٔ گروه در حال آماده‌سازی است. این یک پست نمونه در صف انتشار است.", status: "PENDING", messageId: null, createdAt: "2026-09-18T08:00:00Z", votes: { agree: 0, useful: 0, question: 0 } },
    ],
    alerts: [{ id: "sample-alert", postId: "sample-post-1", text: "به گفتگوی این هفته خوش آمدید.", createdAt: "2026-09-18T09:01:00Z", candidates: members.filter((member) => member.firstVotedAt).map((member) => ({ userId: member.userId, firstVotedAt: member.firstVotedAt })) }],
    events: [
      { id: "sample-event-1", action: "ban", status: "SUCCEEDED", actorId: "900000000", targetId: "900000006", reason: "نقض مکرر قوانین گروه؛ مثال نمایشی", detail: null, createdAt: "2026-09-18T09:05:00Z" },
      { id: "sample-event-2", action: "publish", status: "UNKNOWN", actorId: "900000000", targetId: null, reason: "انتشار پست نمونه", detail: "پاسخ قطعی دریافت نشده؛ پیش از اقدام دوباره، وضعیت تلگرام بررسی شود.", createdAt: "2026-09-18T08:30:00Z" },
      { id: "sample-event-3", action: "sync", status: "FAILED", actorId: "900000000", targetId: null, reason: "به‌روزرسانی شمارنده‌های نمونه", detail: "خطای نمونهٔ ارتباط با تلگرام", createdAt: "2026-09-18T08:20:00Z" },
    ],
  };
}
