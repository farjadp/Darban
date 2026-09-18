import Link from "next/link";
import { pathFor, text, type Locale } from "@/lib/i18n";
import { Icon } from "./icon";

export function ServiceError({locale,href}: {locale:Locale;href?:string}) {
  return <section className="mx-auto max-w-xl py-16"><Icon name="alerts" className="mb-6 size-9 text-forest"/><h1 className="text-2xl font-bold">{text(locale,"اطلاعات فعلاً در دسترس نیست","This information is unavailable")}</h1><p role="alert" className="mt-4 text-sm leading-8 text-muted">{text(locale,"اتصال یا تأیید دسترسی انجام نشد. هیچ آمار یا نتیجه‌ی ساختگی نمایش داده نمی‌شود. دوباره تلاش کنید؛ اگر ادامه داشت، تنظیمات دیتابیس و دسترسی تلگرام را بررسی کنید.","The connection or permission check could not be completed. We are not displaying invented data. Try again; if this continues, check the database configuration and Telegram permissions.")}</p><Link href={href ?? pathFor(locale,"portal")} className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-forest px-5 py-2 text-sm text-white">{text(locale,"تلاش دوباره","Try again")}</Link></section>;
}
