import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { LogoutButton } from "./admin-form";
import { Icon, type IconName } from "./icon";
import { pathFor, text, type Locale } from "@/lib/i18n";

type Props = { locale: Locale; area: "portal" | "admin"; active: string; user: { id: string; name: string; isPlatformAdmin?: boolean }; preview?: boolean; children: ReactNode };
export function WorkspaceShell({ locale, area, active, user, preview = false, children }: Props) {
  const base = pathFor(locale, preview ? area === "admin" ? "preview/admin" : "preview" : area);
  const items: { key: string; fa: string; en: string; icon: IconName; href: string }[] = area === "admin" ? [
    { key: "overview", fa: "نمای کلی سامانه", en: "Overview", icon: "overview", href: base },
    { key: "users", fa: "کاربران", en: "Customers", icon: "members", href: `${base}?view=users` },
    { key: "plans", fa: "پلن‌ها و قیمت‌ها", en: "Plans & pricing", icon: "subscription", href: `${base}?view=plans` },
    { key: "requests", fa: "درخواست‌های اشتراک", en: "Plan requests", icon: "posts", href: `${base}?view=requests` },
    { key: "events", fa: "گزارش مدیریت", en: "Audit log", icon: "events", href: `${base}?view=events` },
  ] : [
    { key: "overview", fa: "فضای من", en: "My workspace", icon: "overview", href: base },
    { key: "posts", fa: "پست‌ها", en: "Posts", icon: "posts", href: `${base}?view=posts` },
    { key: "members", fa: "اعضای مشاهده‌شده", en: "Observed members", icon: "members", href: `${base}?view=members` },
    { key: "alerts", fa: "هشدارها", en: "Alerts", icon: "alerts", href: `${base}?view=alerts` },
    { key: "events", fa: "تاریخچه‌ی اقدامات", en: "Activity log", icon: "events", href: `${base}?view=events` },
    { key: "settings", fa: "قواعد کانال", en: "Channel rules", icon: "settings", href: `${base}?view=settings` },
    { key: "subscription", fa: "اشتراک من", en: "Subscription", icon: "subscription", href: `${base}/subscription` },
    { key: "account", fa: "حساب کاربری", en: "Account", icon: "account", href: `${base}/account` },
  ];
  return <div className="min-h-screen lg:flex">
    <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-e lg:border-b-0">
      <div className="flex items-center justify-between px-6 py-6"><Brand locale={locale} /><span className="rounded-md bg-canvas px-2.5 py-1 text-xs text-muted">{area === "admin" ? text(locale,"مدیریت","Admin") : text(locale,"پرتال","Portal")}</span></div>
      <nav aria-label={text(locale,"منوی فضای کار","Workspace navigation")} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-4 lg:py-3">
        {items.map(item => <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${active === item.key ? "bg-forest font-medium text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}><Icon name={item.icon} /><span>{text(locale,item.fa,item.en)}</span></Link>)}
      </nav>
      <div className="mt-auto hidden space-y-4 border-t border-line px-6 py-5 lg:block">
        <Link href={pathFor(locale,"guide")} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-forest"><Icon name="shield" />{text(locale,"راهنمای راه‌اندازی","Setup guide")}</Link>
        <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint font-semibold text-forest">{user.name.slice(0,1)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><bdi dir="ltr" className="block truncate text-xs text-muted">{user.id}</bdi></div></div>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex min-h-21 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-4 sm:px-8">
        <div><p className="text-sm font-semibold">{area === "admin" ? text(locale,"مدیریت دربان","Darban administration") : text(locale,"فضایی برای جامعه‌ی شما","A space for your community")}</p><p className="mt-1 text-xs text-muted">{area === "admin" ? text(locale,"حساب‌ها، پلن‌ها و سوابق سامانه","Accounts, plans and platform records") : text(locale,"کنترل با شماست؛ هر اقدام ثبت می‌شود.","Your decisions, with a record of every action.")}</p></div>
        <div className="flex flex-wrap items-center gap-2"><LanguageSwitcher locale={locale} />
          {(user.isPlatformAdmin || preview) && <Link href={pathFor(locale,preview ? area === "admin" ? "preview" : "preview/admin" : area === "admin" ? "portal" : "admin")} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted hover:bg-canvas">{area === "admin" ? text(locale,"پرتال من","My portal") : text(locale,"مدیریت سامانه","Administration")}</Link>}
          {preview ? <Link href={pathFor(locale,"login")} className="inline-flex min-h-11 items-center rounded-lg bg-forest px-4 text-sm text-white">{text(locale,"ورود","Sign in")}</Link> : <LogoutButton locale={locale} />}
        </div>
      </header>
      {preview && <div role="status" className="border-b border-line bg-mint px-5 py-3 text-sm leading-7 text-forest sm:px-8"><strong>{text(locale,"پیش‌نمایش با داده‌ی نمونه","Preview with sample data")}</strong><span className="mx-2">·</span>{text(locale,"فقط خواندنی؛ به تلگرام و پرداخت متصل نیست.","Read-only. Not connected to Telegram or payments.")}</div>}
      <main id="main-content" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  </div>;
}
