export type Locale = "fa" | "en";
export const locales: Locale[] = ["fa", "en"];
export function isLocale(value: unknown): value is Locale { return value === "fa" || value === "en"; }
export function localeFromPath(path: string): Locale {
  const first = path.split(/[/?#]/)[1];
  return isLocale(first) ? first : "fa";
}
export function pathFor(locale: Locale, path = "") {
  const suffix = path.replace(/^\/+/, "");
  return `/${locale}${suffix ? `/${suffix}` : ""}`;
}
export function localizePath(path: string, locale: Locale) {
  const suffix = path.replace(/^\/(fa|en)(?=\/|\?|#|$)/, "");
  return suffix.startsWith("?") || suffix.startsWith("#") ? `/${locale}${suffix}` : pathFor(locale, suffix);
}
export function safeReturnPath(value: unknown, locale: Locale) {
  if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u0020]/.test(value) || !/^\/(fa|en)\/(portal|admin)(?:\/|\?|$)/.test(value)) return pathFor(locale, "portal");
  return localizePath(value, locale);
}
export function formatNumber(value: number, locale: Locale) { return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(value); }
export function formatMoney(cents: number, locale: Locale, currency = "USD") {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}
export function formatDate(value: string | Date | null, locale: Locale) {
  return value ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value)) : text(locale, "ثبت نشده", "Not recorded");
}
export function text(locale: Locale, fa: string, en: string) { return locale === "fa" ? fa : en; }
