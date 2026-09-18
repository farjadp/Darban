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
