"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { localizePath, text, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale, variant = "light" }: { locale: Locale; variant?: "light" | "dark" }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const other = locale === "fa" ? "en" : "fa";
  return <Link href={localizePath(`${pathname}${search ? `?${search}` : ""}`, other)} lang={other} hrefLang={other} aria-label={text(locale, "Switch to English", "تغییر زبان به فارسی")} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${variant === "dark" ? "border-white/25 text-white hover:bg-white/10" : "border-line text-ink hover:bg-white"}`}>
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>
    {locale === "fa" ? "English" : "فارسی"}
  </Link>;
}
