import { notFound } from "next/navigation";
import { HomeContent } from "@/components/marketing";
import { SiteFrame } from "@/components/site-frame";
import { isLocale } from "@/lib/i18n";
import { marketingCopy } from "@/lib/marketing-copy";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = marketingCopy[locale];
  return { title: { absolute: locale === "fa" ? "دربان | Darban" : "Darban | دربان" }, description: copy.footer.description };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteFrame locale={locale}><HomeContent locale={locale} /></SiteFrame>;
}
