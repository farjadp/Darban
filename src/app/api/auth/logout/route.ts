import { NextResponse } from "next/server";
import { assertSameOrigin, authCookieOptions, authFailure, NONCE_COOKIE, SESSION_COOKIE } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, "", authCookieOptions(0));
    response.cookies.set(NONCE_COOKIE, "", authCookieOptions(0));
    return response;
  } catch (error) {
    return authFailure(error);
  }
}
