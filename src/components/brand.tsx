import Link from "next/link";
import { pathFor, text, type Locale } from "@/lib/i18n";

export function Brand({ locale, compact = false, href }: { locale: Locale; compact?: boolean; href?: string }) {
  return <Link href={href ?? pathFor(locale)} className="inline-flex min-h-11 shrink-0 items-center gap-2.5 text-ink" aria-label={text(locale, "دربان، صفحه‌ی اصلی", "Darban home")}>
    <svg width="34" height="38" viewBox="0 0 34 38" fill="none" aria-hidden="true" className="shrink-0 text-forest"><path d="M4 33V9a5 5 0 0 1 5-5h19v29" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="m13 8 13-4v29l-13 3V8Z" fill="currentColor"/><circle cx="20" cy="21" r="1.4" fill="#d6f2e0"/><path d="M1 33h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
    {!compact && <span className="text-2xl font-bold">{text(locale, "دربان", "Darban")}<span className="ms-1 text-forest">.</span></span>}
  </Link>;
}
