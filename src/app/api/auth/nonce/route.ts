import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { assertSameOrigin, authConfig, authCookieOptions, authFailure, NONCE_COOKIE } from "../../../../lib/auth";
import { LOGIN_SECONDS } from "../../../../lib/auth-crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    authConfig();
    const nonce = randomBytes(32).toString("hex");
    const response = NextResponse.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(NONCE_COOKIE, nonce, authCookieOptions(LOGIN_SECONDS));
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
