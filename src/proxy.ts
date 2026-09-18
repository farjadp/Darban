import { NextResponse, type NextRequest } from "next/server";
import { localeFromPath } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-darban-locale", localeFromPath(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"] };
