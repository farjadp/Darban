import { afterEach, describe, expect, it, vi } from "vitest";
import { telegram, TelegramError } from "./telegram";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Telegram transport", () => {
  it("fails closed without a token", async () => { vi.stubEnv("GUARD_BOT_TOKEN", ""); await expect(telegram("getMe", {})).rejects.toThrow(); });
  it("sends JSON and returns the Telegram result", async () => {
    vi.stubEnv("GUARD_BOT_TOKEN", "test-token");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { id: 123 } })));
    vi.stubGlobal("fetch", fetch);
    await expect(telegram("getMe", {})).resolves.toEqual({ id: 123 });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}", cache: "no-store" });
  });
  it("does not expose token-bearing network errors", async () => {
    vi.stubEnv("GUARD_BOT_TOKEN", "secret-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("https://api.telegram.org/botsecret-token")));
    try { await telegram("getMe", {}); expect.fail(); } catch (error) { expect(error).toBeInstanceOf(TelegramError); expect(String(error)).not.toContain("secret-token"); expect((error as TelegramError).uncertain).toBe(true); }
  });
  it("distinguishes explicit Telegram rejection from unknown network outcome", async () => {
    vi.stubEnv("GUARD_BOT_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error_code: 403, description: "Forbidden" }))));
    await expect(telegram("getMe", {})).rejects.toMatchObject({ code: 403, uncertain: false });
  });
});

async function refusal(description: string, code = 400) {
  vi.stubEnv("GUARD_BOT_TOKEN", "test-token");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error_code: code, description }))));
  try { await telegram("getChatMember", {}); return null; } catch (error) { return error as TelegramError; }
}

describe("Telegram refusals explain themselves", () => {
  it("translates a recognised description instead of printing only a code", async () => {
    const error = await refusal("Bad Request: member list is inaccessible");
    expect(error?.description).toBe("Bad Request: member list is inaccessible");
    expect(error?.message).toContain("بات هنوز عضو این چت نیست");
    expect(error?.message).not.toBe("درخواست تلگرام رد شد (کد ۴۰۰).");
  });
  it("passes an unrecognised description through verbatim", async () => {
    const error = await refusal("Bad Request: some brand new failure");
    expect(error?.message).toContain("some brand new failure");
  });
  it("still names the code when Telegram sends no description", async () => {
    const error = await refusal("");
    expect(error?.message).toBe("درخواست تلگرام رد شد (کد ۴۰۰).");
    expect(error?.description).toBe("");
  });
  it("never lets the token reach the message or the description", async () => {
    const error = await refusal("Unauthorized for test-token");
    expect(error?.description).not.toContain("test-token");
    expect(String(error)).not.toContain("test-token");
  });
  it("keeps a description to one capped line", async () => {
    const error = await refusal(`Bad Request:\nline two\r${"x".repeat(400)}`);
    expect(error?.description.length).toBeLessThanOrEqual(200);
    expect(error?.description).not.toMatch(/[\r\n]/);
  });
  it("still recognises an unmodified message", async () => {
    const error = await refusal("Bad Request: message is not modified");
    expect(error?.notModified).toBe(true);
  });
});
