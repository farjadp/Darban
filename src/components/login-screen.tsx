import Link from "next/link";
import { redirect } from "next/navigation";
import { authConfig, getUser } from "@/lib/auth";
import { pathFor, safeReturnPath, text, type Locale } from "@/lib/i18n";
import { TelegramLogin } from "./telegram-login";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { Icon } from "./icon";

export async function LoginScreen({ locale, next }: { locale: Locale; next?: string }) {
  const required = ["APP_URL","GUARD_BOT_TOKEN","GUARD_BOT_USERNAME","AUTH_SESSION_SECRET","DATABASE_URL"];
  const missing = required.filter(name => !process.env[name]?.trim());
  let ready = !missing.length;
  if (ready) { try { authConfig(); } catch { ready = false; } }
  if (ready && await getUser()) redirect(safeReturnPath(next,locale));
  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10"><Brand locale={locale} /><LanguageSwitcher locale={locale} /></header>
    <main id="main-content" className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-10 sm:px-10 lg:grid-cols-2 lg:gap-24 lg:py-20">
      <section><h1 className="max-w-xl text-4xl font-bold leading-[1.5] sm:text-5xl sm:leading-[1.4]">{text(locale,"جای گفتگو باز است. کنترل دست شماست.","Room for conversation. Control stays with you.")}</h1><p className="mt-6 max-w-lg text-base leading-8 text-muted">{text(locale,"با حساب تلگرام وارد شوید، گروه یا کانال خود را وصل کنید و قواعد تعامل را در یک فضای روشن مدیریت کنید.","Sign in with Telegram, connect your community, and manage its rules from one clear workspace.")}</p>
        <div className="mt-10 space-y-5 border-t border-line pt-7">{[["فقط کانال‌های تحت مدیریت شما","Only communities you administer"],["تصمیم انسانی برای حذف هر عضو","A human decision before every ban"],["ثبت شفاف اقدام‌ها و نتیجه‌ی آن‌ها","A clear record of actions and outcomes"]].map(([fa,en]) => <p key={en} className="flex items-center gap-3 text-sm"><Icon name="check" className="size-5 shrink-0 text-forest" />{text(locale,fa,en)}</p>)}</div>
      </section>
      <section className="rounded-2xl border border-line bg-white p-7 shadow-sm sm:p-10"><span className="mb-7 flex size-12 items-center justify-center rounded-xl bg-mint text-forest"><Icon name="account" className="size-6" /></span><h2 className="text-2xl font-semibold">{text(locale,"به دربان خوش آمدید","Welcome to Darban")}</h2><p className="mb-8 mt-3 text-sm leading-7 text-muted">{text(locale,"ورود و ساخت حساب با تلگرام انجام می‌شود. رمز عبور تلگرام شما به دربان ارسال نمی‌شود.","Sign in or create an account with Telegram. Your Telegram password is never sent to Darban.")}</p>
        {ready ? <TelegramLogin botUsername={process.env.GUARD_BOT_USERNAME!} locale={locale} returnPath={next} /> : <div role="status" className="rounded-lg bg-canvas px-5 py-5"><h3 className="font-semibold">{text(locale,"ورود هنوز آماده نیست","Sign-in is not available yet")}</h3><p className="mt-2 text-sm leading-7 text-muted">{text(locale,"اتصال سرور باید تکمیل شود. فعلاً می‌توانید تمام بخش‌ها را در پیش‌نمایش ببینید.","The server connection still needs setup. You can explore the interface in the read-only preview.")}</p><details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer py-3">{text(locale,"راهنمای مدیر سرور","Server operator details")}</summary><p className="mb-3 leading-7">{text(locale,"تنظیمات محیط، دیتابیس و دامنه‌ی ورود در BotFather را بررسی کنید. هیچ کلیدی را در مرورگر منتشر نکنید.","Check environment settings, PostgreSQL, and the login domain in BotFather. Never expose secret values in the browser.")}</p>{missing.length > 0 && <ul dir="ltr" className="space-y-1 text-start font-mono text-xs">{missing.map(name => <li key={name}>{name}</li>)}</ul>}</details></div>}
        <div className="mt-8 border-t border-line pt-6"><Link href={pathFor(locale,"preview")} className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-forest">{text(locale,"اول محیط را ببینید","Explore before signing in")}<Icon name="arrow" className="size-5 rtl:rotate-180" /></Link><p className="mt-2 text-xs leading-6 text-muted">{text(locale,"پیش‌نمایش فقط‌خواندنی با داده‌ی نمونه؛ بدون عملیات واقعی.","Read-only sample data. No real operations.")}</p></div>
      </section>
    </main>
    <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t border-line px-6 py-7 text-xs text-muted"><span>{text(locale,"دربان برای مدیریت رفتار است، نه تشخیص عقیده.","Darban moderates behavior, never beliefs.")}</span><Link href={pathFor(locale,"guide")} className="underline underline-offset-4">{text(locale,"راهنمای شروع","Getting started")}</Link></footer>
  </div>;
}
