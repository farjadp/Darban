import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { verifySession, type Admin } from "./auth-crypto";
import { db } from "./db";

export type User = Admin & { locale: "fa" | "en"; isPlatformAdmin: boolean };

export function isPlatformAdminId(id: string): boolean {
  return /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id)) && (process.env.GUARD_ADMIN_IDS ?? "").split(",").map(value => value.trim()).includes(id);
}

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
  const configuredIds = (process.env.GUARD_ADMIN_IDS ?? "").trim();
  const ids = configuredIds ? configuredIds.split(",").map((id) => id.trim()) : [];
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

export function localizedError(request: Request | undefined, status: number, fa: string): string {
  if (request?.headers.get("x-darban-locale") !== "en") return fa;
  const messages: Record<number, string> = {
    400: "Invalid request. Check the submitted information.",
    401: "Please sign in to continue.",
    403: "Access denied or the request has expired. Refresh and try again.",
    404: "The requested record was not found or is not accessible.",
    409: "The request conflicts with the current state. Check its status before retrying.",
    413: "The request is too large.", 415: "The request must use JSON.",
    429: "Too many requests. Please try again later.",
    502: "Telegram is temporarily unavailable. Check the operation status before retrying.",
  };
  return messages[status] ?? "The service is unavailable. Check the operation status before retrying.";
}

export function authFailure(error: unknown, request?: Request): NextResponse {
  const status = error instanceof AuthError ? error.status : 503;
  const message = localizedError(request, status, error instanceof AuthError ? error.message : "سرویس در دسترس نیست. دوباره تلاش کنید.");
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function getUser(): Promise<User | null> {
  try {
    const config = authConfig();
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
    const session = verifySession(cookie, config.secret);
    if (!session) return null;
    const account = await db.account.findUnique({ where: { id: session.id } });
    if (!account || account.status !== "ACTIVE") return null;
    return { id: account.id, name: account.name, locale: account.locale === "en" ? "en" : "fa", isPlatformAdmin: isPlatformAdminId(account.id) };
  } catch { return null; }
}

export async function requireUser(locale: "fa" | "en" = "fa"): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/${locale === "en" ? "en" : "fa"}/login`);
  return user;
}

export async function getAdmin(): Promise<Admin | null> {
  const user = await getUser();
  return user?.isPlatformAdmin ? { id: user.id, name: user.name } : null;
}

export async function requireAdmin(locale: "fa" | "en" = "fa"): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect(`/${locale === "en" ? "en" : "fa"}/login`);
  return admin;
}
