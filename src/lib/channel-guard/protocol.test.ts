import { describe, expect, it } from "vitest";
import { checkVote, parseCallback, voteKeyboard, detectBrigade, observedJoin } from "./protocol";

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
