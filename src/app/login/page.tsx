import Link from "next/link";
import { redirect } from "next/navigation";
import { authConfig, getAdmin } from "@/lib/auth";
import { TelegramLogin } from "@/components/telegram-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود مدیر | مدیریت تلگرام" };

export default async function Login() {
  const required = ["APP_URL", "GUARD_BOT_TOKEN", "GUARD_BOT_USERNAME", "GUARD_ADMIN_IDS", "GUARD_WEBHOOK_SECRET", "AUTH_SESSION_SECRET", "DATABASE_URL"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  let valid = missing.length === 0;
  if (valid) {
    try { authConfig(); } catch { valid = false; }
  }
  if (valid && await getAdmin()) redirect("/");
  return <div className="min-h-screen bg-zinc-50">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-7 sm:px-10"><Link href="/login" className="flex items-center gap-3 text-lg font-bold"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-7"><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4zm-4 9 3 3 5-6" /></svg>مدیریت تلگرام</Link><Link href="/preview" className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100">دیدن پیش‌نمایش</Link></header>
    <main id="main-content" className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:pt-20">
      <section className="max-w-xl"><h1 className="text-3xl font-bold leading-relaxed sm:text-4xl sm:leading-relaxed">مدیریت کانال،<br />با تصمیم شما.</h1><p className="mt-6 max-w-lg text-base leading-9 text-zinc-600">پست منتشر کنید، تعامل‌های ثبت‌شده را ببینید و هشدارها را با شواهد بررسی کنید. هر اقدام مدیریتی، با تأیید شما و در گزارش عملیات ثبت می‌شود.</p>
        <dl className="mt-10 divide-y divide-zinc-200 border-y border-zinc-200"><div className="py-5"><dt className="text-sm font-semibold">دسترسی محدود به کانال‌های شما</dt><dd className="mt-2 text-sm leading-7 text-zinc-600">ورود فقط برای شناسه‌های مدیریتی مجاز است. دسترسی هر کانال جداگانه بررسی می‌شود.</dd></div><div className="py-5"><dt className="text-sm font-semibold">هشدار برای بررسی، نه قضاوت</dt><dd className="mt-2 text-sm leading-7 text-zinc-600">هم‌زمانی رفتار، اثبات تخلف نیست. هیچ حسابی صرفاً به دلیل هشدار خودکار مسدود نمی‌شود.</dd></div><div className="py-5"><dt className="text-sm font-semibold">سوابق شفاف، بدون آمار ساختگی</dt><dd className="mt-2 text-sm leading-7 text-zinc-600">فقط داده‌هایی نمایش داده می‌شوند که ربات دریافت و ثبت کرده است؛ نه فهرست کامل اعضای تلگرام.</dd></div></dl>
      </section>
      <section className="self-start rounded-xl border border-zinc-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">ورود به فضای مدیریت</h2><p className="mb-7 mt-3 text-sm leading-7 text-zinc-600">با حساب تلگرامی که مدیر سامانه مجاز کرده است وارد شوید. این سامانه رمز عبور تلگرام شما را دریافت نمی‌کند.</p>
        {valid ? <TelegramLogin botUsername={process.env.GUARD_BOT_USERNAME!} /> : <div role="alert" className="border-y border-zinc-200 py-5"><h3 className="font-semibold">اتصال هنوز آماده نیست</h3><p className="mt-2 text-sm leading-7 text-zinc-600">{missing.length ? "ورود غیرفعال است. متغیرهای زیر باید در محیط سرور تنظیم شوند:" : "ورود غیرفعال است. قالب تنظیمات ورود معتبر نیست؛ تنظیمات سرور را بررسی کنید."}</p>{missing.length > 0 && <ul dir="ltr" className="mt-4 space-y-2 text-left font-mono text-xs leading-6 text-zinc-800">{missing.map((name) => <li key={name}>{name}</li>)}</ul>}</div>}
        <details className="mt-6 border-b border-zinc-200 pb-5" open={!valid}><summary className="cursor-pointer text-sm font-medium">راهنمای راه‌اندازی برای مدیر سرور</summary><ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-8 text-zinc-600"><li>در <bdi dir="ltr">@BotFather</bdi> ربات بسازید و تنظیمات محیط سرور را تکمیل کنید. کلیدها و توکن‌ها را در مرورگر یا گفتگو منتشر نکنید.</li><li>با دستور <bdi dir="ltr">/setdomain</bdi> در <bdi dir="ltr">@BotFather</bdi>، دامنهٔ عمومی و امن برنامه را برای همان ربات ثبت کنید. دامنه باید با <bdi dir="ltr">APP_URL</bdi> یکسان باشد.</li><li>پایگاه داده و وب‌هوک امن ربات را راه‌اندازی کنید. سپس ربات را با دسترسی‌های لازم مدیر کانال و گروه گفتگو کنید.</li></ol></details>
        <div className="mt-6"><p className="text-sm leading-7 text-zinc-600">می‌خواهید اول محیط را ببینید؟</p><Link href="/preview" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline decoration-zinc-400 underline-offset-4">پیش‌نمایش فقط‌خواندنی با دادهٔ نمونه<span aria-hidden="true">←</span></Link><p className="mt-2 text-xs leading-6 text-zinc-500">پیش‌نمایش به تلگرام متصل نیست و ورود را دور نمی‌زند.</p></div>
      </section>
    </main>
    <footer className="mx-auto max-w-7xl border-t border-zinc-200 px-6 py-6 text-xs leading-6 text-zinc-500 sm:px-10">توکن ربات و اطلاعات محرمانه فقط در سرور نگهداری می‌شوند.</footer>
  </div>;
}
