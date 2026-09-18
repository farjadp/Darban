import type { Metadata } from "next";
import { headers } from "next/headers";
import { isLocale, text } from "@/lib/i18n";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Darban | دربان", template: "%s | Darban" },
  description: "Human-led moderation for Telegram communities. مدیریت گروه‌ها و کانال‌های تلگرام با تصمیم شما.",
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requested = (await headers()).get("x-darban-locale");
  const locale = isLocale(requested) ? requested : "fa";
  return <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}><body className="bg-canvas font-sans text-ink antialiased"><a href="#main-content" className="sr-only z-50 rounded-lg bg-forest text-sm text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:px-5 focus:py-3">{text(locale, "رفتن به محتوای اصلی", "Skip to content")}</a>{children}</body></html>;
}
