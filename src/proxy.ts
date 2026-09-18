import { NextResponse, type NextRequest } from "next/server";
import { localeFromPath } from "@/lib/i18n";

// Paths from before the locale prefix existed. Handled here so the browser
// gets a real 307 instead of a rendered page carrying a meta refresh.
const legacy: Record<string, string> = { "/": "/fa", "/login": "/fa/login", "/preview": "/fa/preview" };

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = legacy[pathname];
  if (target) return NextResponse.redirect(new URL(`${target}${search}`, request.url), 307);
  const headers = new Headers(request.headers);
  headers.set("x-darban-locale", localeFromPath(pathname));
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"] };
