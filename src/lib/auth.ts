import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { verifySession, type Admin } from "./auth-crypto";

export const SESSION_COOKIE = "guard_session";
export const NONCE_COOKIE = "guard_login_nonce";

export class AuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function appOrigin(): string {
  try {
    const url = new URL(process.env.APP_URL ?? "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error();
    return url.origin;
  } catch {
    throw new AuthError(503, "تنظیمات ورود کامل نیست.");
  }
}

export function authConfig() {
  const token = process.env.GUARD_BOT_TOKEN ?? "";
  const username = process.env.GUARD_BOT_USERNAME ?? "";
  const secret = process.env.AUTH_SESSION_SECRET ?? "";
  const ids = (process.env.GUARD_ADMIN_IDS ?? "").split(",").map((id) => id.trim());
  const origin = appOrigin();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) || !/bot$/i.test(username) || Buffer.byteLength(secret, "utf8") < 32 || ids.some((id) => !/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new AuthError(503, "تنظیمات ورود کامل نیست.");
  }
  return { token, username, secret, adminIds: new Set(ids), origin };
}

export function assertSameOrigin(request: Request): void {
  const expected = appOrigin();
  if (request.headers.get("origin") !== expected) throw new AuthError(403, "درخواست ورود معتبر نیست.");
}

export function authCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export function authFailure(error: unknown): NextResponse {
  const status = error instanceof AuthError ? error.status : 503;
  const message = error instanceof AuthError ? error.message : "سرویس ورود در دسترس نیست. دوباره تلاش کنید.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function getAdmin(): Promise<Admin | null> {
  try {
    const config = authConfig();
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
    const admin = verifySession(cookie, config.secret);
    return admin && config.adminIds.has(admin.id) ? admin : null;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}
