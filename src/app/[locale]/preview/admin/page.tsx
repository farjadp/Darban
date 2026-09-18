import { notFound } from "next/navigation";
import { PlatformAdmin, parseAdminView } from "@/components/platform-admin";
import { isLocale, text } from "@/lib/i18n";
import { samplePlatformOverview } from "@/lib/platform-sample";

export async function generateMetadata({ params }: PageProps<"/[locale]/preview/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: text(locale, "پیش‌نمایش مدیریت", "Admin preview"), robots: { index: false, follow: false } };
}

export default async function AdminPreview({ params, searchParams }: PageProps<"/[locale]/preview/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const user = { id: "900000000", name: text(locale, "مدیر نمونه", "Sample admin"), isPlatformAdmin: true };
  return <PlatformAdmin locale={locale} view={parseAdminView(query.view)} data={samplePlatformOverview()} user={user} preview />;
}
