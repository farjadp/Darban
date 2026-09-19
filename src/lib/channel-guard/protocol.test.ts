import { describe, expect, it } from "vitest";
import { checkVote, parseCallback, voteKeyboard, detectBrigade, observedJoin, isServiceJoinLeave, isSlashCommand, hasLinkOrMention, detectMediaType, isMediaMessage } from "./protocol";

const now = new Date("2026-09-18T12:00:00Z");
const member = { banned: false, verified: true, present: true, joinedAt: null as Date | null };
const rules = { verification: true, waitHours: 24 };

describe("vote gates", () => {
  it("allows existing members with an unknown join date", () => expect(checkVote(member, rules, now)).toEqual({ allowed: true }));
  it("blocks banned accounts before verification", () => expect(checkVote({ ...member, banned: true, verified: false }, rules, now)).toMatchObject({ allowed: false, reason: "banned" }));
  it("requires private-chat verification", () => expect(checkVote({ ...member, verified: false }, rules, now)).toMatchObject({ reason: "verification" }));
  it("can disable verification per chat", () => expect(checkVote({ ...member, verified: false }, { ...rules, verification: false }, now)).toEqual({ allowed: true }));
  it("rejects users who left", () => expect(checkVote({ ...member, present: false }, rules, now)).toMatchObject({ reason: "membership" }));
  it("rounds remaining wait upward", () => expect(checkVote({ ...member, joinedAt: new Date(now.getTime() - 23.5 * 3600000) }, rules, now)).toMatchObject({ reason: "waiting", hours: 1 }));
  it("allows voting at exactly 24 hours", () => expect(checkVote({ ...member, joinedAt: new Date(now.getTime() - 24 * 3600000) }, rules, now)).toEqual({ allowed: true }));
  it("can disable the waiting period", () => expect(checkVote({ ...member, joinedAt: now }, { ...rules, waitHours: 0 }, now)).toEqual({ allowed: true }));
});

describe("callback protocol", () => {
  it("parses scoped vote callbacks", () => expect(parseCallback("v:post123:agree")).toEqual({ postId: "post123", choice: "agree" }));
  it.each(["", "v::agree", "v:a:delete", "v:a:agree:extra", "ban:123", "v:../../:agree"])("rejects malformed payload %s", (value) => expect(parseCallback(value)).toBeNull());
  it("builds buttons from recounted rows", () => expect(voteKeyboard("post123", { agree: 2, useful: 1, question: 0 }).inline_keyboard[0][0]).toMatchObject({ callback_data: "v:post123:agree", text: "موافقم · ۲" }));
});

describe("brigade evidence", () => {
  const vote = (id: string, age = 0, first = true) => ({ userId: id, createdAt: new Date(now.getTime() - age * 1000), first });
  it("flags five distinct first-time voters", () => expect(detectBrigade([1,2,3,4,5].map(x => vote(String(x))), now)).toHaveLength(5));
  it("does not flag four", () => expect(detectBrigade([1,2,3,4].map(x => vote(String(x))), now)).toEqual([]));
  it("deduplicates account IDs", () => expect(detectBrigade([1,1,2,3,4].map(x => vote(String(x))), now)).toEqual([]));
  it("excludes old, future and returning voters", () => expect(detectBrigade([vote("1"), vote("2"), vote("3",91), vote("4",-1), vote("5",0,false)], now)).toEqual([]));
  it("includes the 90-second boundary", () => expect(detectBrigade([1,2,3,4,5].map(x => vote(String(x),90)), now)).toHaveLength(5));
});

describe("observed membership transitions", () => {
  it("records an observed join", () => expect(observedJoin("left", "member", false, true)).toBe(true));
  it("does not reset join dates on promotion", () => expect(observedJoin("member", "administrator", true, true)).toBe(false));
  it("records rejoining after a ban", () => expect(observedJoin("kicked", "member", false, true)).toBe(true));
  it("recognizes restricted members still in the group", () => expect(observedJoin("restricted", "member", true, true)).toBe(false));
});

describe("service join/leave detection", () => {
  it("recognizes new_chat_members array", () => expect(isServiceJoinLeave({ new_chat_members: [{ id: "1", first_name: "عضو" }] })).toBe(true));
  it("recognizes new_chat_member object", () => expect(isServiceJoinLeave({ new_chat_member: { id: "1", first_name: "عضو" } })).toBe(true));
  it("recognizes left_chat_member object", () => expect(isServiceJoinLeave({ left_chat_member: { id: "1", first_name: "عضو" } })).toBe(true));
  it("ignores regular text messages", () => expect(isServiceJoinLeave({})).toBe(false));
  it("ignores empty new_chat_members array", () => expect(isServiceJoinLeave({ new_chat_members: [] })).toBe(false));
});

describe("slash command detection", () => {
  it("recognizes standard bot commands", () => expect(isSlashCommand("/help")).toBe(true));
  it("recognizes commands with bot username", () => expect(isSlashCommand("/start@darban_bot")).toBe(true));
  it("recognizes commands with arguments", () => expect(isSlashCommand("/ban 123 spam")).toBe(true));
  it("handles leading and trailing whitespace", () => expect(isSlashCommand("  /stats  ")).toBe(true));
  it("ignores regular text containing slashes", () => expect(isSlashCommand("check out this link/page")).toBe(false));
  it("ignores double slashes or comments", () => expect(isSlashCommand("// comment")).toBe(false));
  it("ignores bare slash or empty text", () => {
    expect(isSlashCommand("/")).toBe(false);
    expect(isSlashCommand("")).toBe(false);
    expect(isSlashCommand(null)).toBe(false);
  });
});

describe("link and mention detection", () => {
  it("recognizes web links in text", () => {
    expect(hasLinkOrMention({ text: "Visit https://example.com" })).toBe(true);
    expect(hasLinkOrMention({ text: "http://my-site.ir/page" })).toBe(true);
  });
  it("recognizes Telegram links in text", () => {
    expect(hasLinkOrMention({ text: "عضویت در کانال: t.me/darban_channel" })).toBe(true);
    expect(hasLinkOrMention({ text: "telegram.me/joinchat/xyz" })).toBe(true);
  });
  it("recognizes @mentions in text", () => {
    expect(hasLinkOrMention({ text: "آیدی من: @my_username" })).toBe(true);
  });
  it("recognizes links in photo/media captions", () => {
    expect(hasLinkOrMention({ caption: "تخفیف ویژه در https://shop.com" })).toBe(true);
    expect(hasLinkOrMention({ caption: "ارتباط با ما: @support" })).toBe(true);
  });
  it("recognizes Telegram entity links and text_links", () => {
    expect(hasLinkOrMention({ text: "کلیک کنید", entities: [{ type: "text_link", url: "https://evil.com" }] })).toBe(true);
    expect(hasLinkOrMention({ text: "سلام", entities: [{ type: "url" }] })).toBe(true);
    expect(hasLinkOrMention({ text: "سلام", entities: [{ type: "mention" }] })).toBe(true);
  });
  it("ignores regular text without links or mentions", () => {
    expect(hasLinkOrMention({ text: "سلام دوستان، روزتون بخیر" })).toBe(false);
    expect(hasLinkOrMention({ text: "" })).toBe(false);
    expect(hasLinkOrMention({})).toBe(false);
  });
});

describe("media detection", () => {
  it("detects photos", () => {
    expect(detectMediaType({ photo: [{ file_id: "1" }] })).toBe("photo");
    expect(isMediaMessage({ photo: [{ file_id: "1" }] })).toBe(true);
  });
  it("detects videos and animations/gifs", () => {
    expect(detectMediaType({ video: { file_id: "v1" } })).toBe("video");
    expect(detectMediaType({ animation: { file_id: "a1" } })).toBe("animation");
    expect(isMediaMessage({ video: { file_id: "v1" } })).toBe(true);
    expect(isMediaMessage({ animation: { file_id: "a1" } })).toBe(true);
  });
  it("detects stickers", () => {
    expect(detectMediaType({ sticker: { file_id: "s1" } })).toBe("sticker");
    expect(isMediaMessage({ sticker: { file_id: "s1" } })).toBe(true);
  });
  it("detects audio and voice notes", () => {
    expect(detectMediaType({ audio: { file_id: "au1" } })).toBe("audio");
    expect(detectMediaType({ voice: { file_id: "vo1" } })).toBe("voice");
    expect(isMediaMessage({ audio: { file_id: "au1" } })).toBe(true);
    expect(isMediaMessage({ voice: { file_id: "vo1" } })).toBe(true);
  });
  it("detects documents and video notes", () => {
    expect(detectMediaType({ document: { file_id: "d1" } })).toBe("document");
    expect(detectMediaType({ video_note: { file_id: "vn1" } })).toBe("video_note");
    expect(isMediaMessage({ document: { file_id: "d1" } })).toBe(true);
    expect(isMediaMessage({ video_note: { file_id: "vn1" } })).toBe(true);
  });
  it("returns null / false for plain text messages", () => {
    expect(detectMediaType({ photo: [] })).toBeNull();
    expect(detectMediaType({})).toBeNull();
    expect(isMediaMessage({})).toBe(false);
  });
});



