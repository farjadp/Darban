import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadDashboard, parseView } from "@/lib/dashboard";
import { Dashboard } from "@/components/dashboard";
import { LogoutButton } from "@/components/admin-form";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ chat?: string | string[]; view?: string | string[] }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const chatId = typeof params.chat === "string" ? params.chat : undefined;
  let data;
  try {
    if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
    data = await loadDashboard(admin.id, chatId);
  } catch {
    return <main id="main-content" className="mx-auto max-w-2xl px-6 py-20"><div className="mb-12 flex items-center justify-between"><span className="font-semibold">مدیریت تلگرام</span><LogoutButton /></div><h1 className="text-2xl font-bold">داده‌های کانال در دسترس نیست</h1><p role="alert" className="mt-5 text-sm leading-8 text-zinc-600">دریافت اطلاعات یا تأیید دسترسی مدیریتی در تلگرام انجام نشد. آمار و فهرست‌ها بارگذاری نشده‌اند؛ این خطا به معنی خالی بودن کانال نیست. اتصال تلگرام، مجوز مدیریتی حساب شما و اتصال و تنظیمات پایگاه داده را بررسی کنید.</p><Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-zinc-950 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700">تلاش دوباره</Link></main>;
  }
  const configurationReady = ["APP_URL", "GUARD_BOT_TOKEN", "GUARD_BOT_USERNAME", "GUARD_ADMIN_IDS", "GUARD_WEBHOOK_SECRET", "AUTH_SESSION_SECRET", "DATABASE_URL"].every((name) => Boolean(process.env[name]?.trim()));
  return <Dashboard data={data} view={parseView(params.view)} admin={admin} configurationReady={configurationReady} />;
}
