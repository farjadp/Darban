import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, verifySession, verifyTelegramLogin } from "./auth-crypto";
import { assertSameOrigin, getAdmin, requireAdmin, SESSION_COOKIE, NONCE_COOKIE } from "./auth";
import { POST as login } from "../app/api/auth/telegram/route";
import { POST as nonce } from "../app/api/auth/nonce/route";
import { POST as logout } from "../app/api/auth/logout/route";

const mocks = vi.hoisted(() => ({ cookies: new Map<string, string>(), receipt: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => {
  const value = mocks.cookies.get(key);
  return value ? { value } : undefined;
} }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./db", () => ({ db: { loginReceipt: { create: mocks.receipt } } }));

const token = "123456:telegram-test-token";
const secret = "a-secure-test-secret-with-at-least-32-bytes";
const now = 1_800_000_000;
function signed(fields: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { id: 123456, first_name: "مدیر", auth_date: now, ...fields };
  const canonical = Object.keys(data).sort().map((key) => `${key}=${data[key]}`).join("\n");
  return { ...data, hash: createHmac("sha256", createHash("sha256").update(token).digest()).update(canonical).digest("hex") };
}
function request(path: string, body?: unknown, origin = "https://guard.example") {
  return new Request(`https://guard.example/api/auth/${path}`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("GUARD_BOT_TOKEN", token);
  vi.stubEnv("GUARD_BOT_USERNAME", "ExampleGuardBot");
  vi.stubEnv("GUARD_ADMIN_IDS", "123456, 987654");
  vi.stubEnv("AUTH_SESSION_SECRET", secret);
  vi.stubEnv("APP_URL", "https://guard.example");
  mocks.cookies.clear();
  mocks.receipt.mockReset().mockResolvedValue({});
});

describe("Telegram signature verification", () => {
  it("accepts canonical signed fields and normalizes the ID", () => {
    expect(verifyTelegramLogin(signed({ last_name: "تست", username: "admin_test", photo_url: "https://t.me/photo.jpg" }), token, now))
      .toMatchObject({ id: "123456", name: "مدیر تست", authDate: now });
  });
  it("rejects tampered identities and a wrong bot secret", () => {
    expect(verifyTelegramLogin({ ...signed(), id: 987654 }, token, now)).toBeNull();
    expect(verifyTelegramLogin(signed(), "wrong-token", now)).toBeNull();
  });
  it.each([now - 301, now + 31])("rejects timestamps outside the window: %s", (auth_date) => {
    expect(verifyTelegramLogin(signed({ auth_date }), token, now)).toBeNull();
  });
  it.each([now - 300, now + 30])("accepts exact timestamp boundaries: %s", (auth_date) => {
    expect(verifyTelegramLogin(signed({ auth_date }), token, now)).not.toBeNull();
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "00123", "1e3", "-4", "", null, {}, true])("rejects malformed ID %j without throwing", (id) => {
    expect(verifyTelegramLogin(signed({ id }), token, now)).toBeNull();
  });
  it.each(["", "ff", "z".repeat(64), null, 12])("rejects malformed hash %j", (hash) => {
    expect(verifyTelegramLogin({ ...signed(), hash }, token, now)).toBeNull();
  });
  it("rejects unknown fields even when signed and canonical newline injection", () => {
    expect(verifyTelegramLogin(signed({ admin: true }), token, now)).toBeNull();
    expect(verifyTelegramLogin(signed({ first_name: "a\nid=987654" }), token, now)).toBeNull();
  });
  it.each([null, [], "data", { id: 1 }].map((data) => ({ data })))("rejects malformed payload $data", ({ data }) => {
    expect(verifyTelegramLogin(data, token, now)).toBeNull();
  });
});

describe("signed sessions", () => {
  it("round trips and randomizes tokens for the same user", () => {
    const session = createSession({ id: "123456", name: "مدیر" }, secret, now);
    expect(verifySession(session, secret, now)).toEqual({ id: "123456", name: "مدیر" });
    expect(createSession({ id: "123456", name: "مدیر" }, secret, now)).not.toBe(session);
    expect(verifySession(session, secret, now + 28_800)).toBeNull();
  });
  it("rejects tampering, wrong secrets, malformed tokens, and short secrets", () => {
    const session = createSession({ id: "123456", name: "مدیر" }, secret, now);
    expect(verifySession(`${session}x`, secret, now)).toBeNull();
    expect(verifySession(session, "different-long-secret-123456789012345", now)).toBeNull();
    expect(verifySession("invalid", secret, now)).toBeNull();
    expect(verifySession(session, "short", now)).toBeNull();
    expect(() => createSession({ id: "123456", name: "مدیر" }, "short", now)).toThrow();
  });
  it("rejects future-issued sessions even within Telegram's clock drift allowance", () => {
    const session = createSession({ id: "123456", name: "مدیر" }, secret, now + 1);
    expect(verifySession(session, secret, now)).toBeNull();
  });
  it("rejects correctly signed payloads exceeding the maximum lifetime", () => {
    const payload = Buffer.from(JSON.stringify({ id: "123456", name: "مدیر", iat: now, exp: now + 28_801, jti: "a".repeat(64) })).toString("base64url");
    const mac = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifySession(`${payload}.${mac}`, secret, now)).toBeNull();
  });
});

describe("admin and origin protection", () => {
  it("checks the allowlist on every request and redirects pages only", async () => {
    mocks.cookies.set(SESSION_COOKIE, createSession({ id: "123456", name: "مدیر" }, secret));
    expect(await getAdmin()).toEqual({ id: "123456", name: "مدیر" });
    vi.stubEnv("GUARD_ADMIN_IDS", "987654");
    expect(await getAdmin()).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("redirect:/login");
  });
  it("fails closed when required configuration is absent", async () => {
    mocks.cookies.set(SESSION_COOKIE, createSession({ id: "123456", name: "مدیر" }, secret));
    vi.stubEnv("AUTH_SESSION_SECRET", "");
    expect(await getAdmin()).toBeNull();
    expect((await nonce(request("nonce"))).status).toBe(503);
  });
  it("uses APP_URL rather than the Host header and rejects missing origins", () => {
    expect(() => assertSameOrigin(request("logout"))).not.toThrow();
    expect(() => assertSameOrigin(request("logout", undefined, "https://evil.example"))).toThrow();
    expect(() => assertSameOrigin(new Request("https://evil.example", { method: "POST", headers: { host: "guard.example" } }))).toThrow();
  });
});

describe("authentication endpoints", () => {
  it("issues an uncached nonce in a secure production HttpOnly cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await nonce(request("nonce"));
    expect(response.status).toBe(200);
    expect((await response.json()).nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });
  it("denies mismatched nonce before touching replay storage", async () => {
    const response = await login(request("telegram", { nonce: "a".repeat(64), data: signed() }));
    expect(response.status).toBe(403);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("creates a receipt and session only for a fresh signed admin login", async () => {
    const data = signed({ auth_date: Math.floor(Date.now() / 1000) });
    mocks.cookies.set(NONCE_COOKIE, "a".repeat(64));
    const response = await login(request("telegram", { nonce: "a".repeat(64), data }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.receipt).toHaveBeenCalledWith({ data: { hash: data.hash, expiresAt: expect.any(Date) } });
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
  });
  it("denies duplicate receipts and never returns a session", async () => {
    mocks.cookies.set(NONCE_COOKIE, "a".repeat(64));
    mocks.receipt.mockRejectedValue({ code: "P2002" });
    const response = await login(request("telegram", { nonce: "a".repeat(64), data: signed({ auth_date: Math.floor(Date.now() / 1000) }) }));
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie") ?? "").not.toContain(`${SESSION_COOKIE}=`);
  });
  it("denies non-admins without recording a receipt", async () => {
    mocks.cookies.set(NONCE_COOKIE, "a".repeat(64));
    const response = await login(request("telegram", { nonce: "a".repeat(64), data: signed({ id: 222222, auth_date: Math.floor(Date.now() / 1000) }) }));
    expect(response.status).toBe(403);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("fails closed when replay storage is unavailable", async () => {
    mocks.cookies.set(NONCE_COOKIE, "a".repeat(64));
    mocks.receipt.mockRejectedValue(new Error("database unavailable"));
    const response = await login(request("telegram", { nonce: "a".repeat(64), data: signed({ auth_date: Math.floor(Date.now() / 1000) }) }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("database unavailable");
  });
  it("rejects cross-origin mutations and clears cookies on logout", async () => {
    expect((await nonce(request("nonce", undefined, "https://evil.example"))).status).toBe(403);
    expect((await logout(request("logout", undefined, "https://evil.example"))).status).toBe(403);
    const response = await logout(request("logout"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
