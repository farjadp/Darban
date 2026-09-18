import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { limitedJson } from "@/lib/http";
import { db } from "../../../../lib/db";
import { upsertAccount } from "@/lib/accounts";
import { assertSameOrigin, authConfig, authCookieOptions, AuthError, authFailure, NONCE_COOKIE, SESSION_COOKIE } from "../../../../lib/auth";
import { createSession, equalHex, LOGIN_SECONDS, SESSION_SECONDS, verifyTelegramLogin } from "../../../../lib/auth-crypto";

export const runtime = "nodejs";

const bodySchema = z.strictObject({ nonce: z.string().regex(/^[a-f0-9]{64}$/), data: z.unknown(), locale: z.enum(["fa", "en"]).optional() });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const config = authConfig();
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AuthError(400, "ساختار درخواست معتبر نیست.");
    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await limitedJson(request, 16_384));
    } catch {
      throw new AuthError(400, "ساختار درخواست معتبر نیست.");
    }
    const nonce = (await cookies()).get(NONCE_COOKIE)?.value;
    if (!equalHex(nonce, body.nonce)) throw new AuthError(403, "درخواست ورود منقضی شده است. صفحه را تازه کنید.");
    const now = Math.floor(Date.now() / 1000);
    const admin = verifyTelegramLogin(body.data, config.token, now);
    if (!admin) throw new AuthError(403, "ورود مجاز نیست یا درخواست منقضی شده است.");
    const session = createSession({ id: admin.id, name: admin.name }, config.secret, now);
    try {
      await db.$transaction(async tx => {
        await tx.loginReceipt.create({ data: { hash: admin.hash, expiresAt: new Date((admin.authDate + LOGIN_SECONDS + 1) * 1000) } });
        await upsertAccount(tx, admin, body.locale);
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new AuthError(403, "این درخواست ورود قبلاً استفاده شده است. دوباره وارد شوید.");
      throw error;
    }
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, session, authCookieOptions(SESSION_SECONDS));
    response.cookies.set(NONCE_COOKIE, "", authCookieOptions(0));
    return response;
  } catch (error) {
    return authFailure(error, request);
  }
}
