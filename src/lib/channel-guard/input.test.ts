import { describe, expect, it } from "vitest";
import { adminInput, updateSchema } from "./input";

describe("request boundaries", () => {
  it("rejects unsafe numeric Telegram IDs", () => expect(updateSchema.safeParse({ update_id: 1, message: { message_id: 1, chat: { id: 1e20, type: "private" } } }).success).toBe(false));
  it("normalizes Telegram IDs to strings", () => expect(updateSchema.parse({ update_id: 1, message: { message_id: 1, chat: { id: -100123, type: "channel" } } }).message?.chat.id).toBe("-100123"));
  it("rejects moderation without an explicit reason and request ID", () => expect(adminInput.safeParse({ operation: "moderate", chatId: "-100", targetId: "20", action: "ban" }).success).toBe(false));
  it("rejects impossible waiting periods", () => expect(adminInput.safeParse({ operation: "settings", chatId: "-100", waitHours: -1, verification: true, commentGate: false, discussionChatId: null }).success).toBe(false));
  it("does not accept a private chat for management", () => expect(adminInput.safeParse({ operation: "connect", chatId: "123" }).success).toBe(false));
});
