import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { parseView, sampleDashboard } from "@/lib/dashboard";
import { isLocale, text } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/preview">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: text(locale, "پیش‌نمایش", "Preview"), robots: { index: false, follow: false } };
}

export default async function Preview({ params, searchParams }: PageProps<"/[locale]/preview">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const data = sampleDashboard();
  if (typeof query.chat === "string" && query.chat !== data.chat?.id) {
    data.chat = null;
    data.unavailableChat = true;
  }
  const admin = { id: "900000000", name: text(locale, "مدیر نمونه", "Sample admin"), isPlatformAdmin: true };
  return <Dashboard locale={locale} data={data} view={parseView(typeof query.view === "string" ? query.view : undefined)} admin={admin} preview />;
}
