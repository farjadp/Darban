import { notFound } from "next/navigation";
import { FeaturesContent } from "@/components/marketing";
import { SiteFrame } from "@/components/site-frame";
import { isLocale } from "@/lib/i18n";
import { marketingCopy } from "@/lib/marketing-copy";

export async function generateMetadata({ params }: PageProps<"/[locale]/features">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: marketingCopy[locale].nav.features, description: marketingCopy[locale].features.body };
}

export default async function Features({ params }: PageProps<"/[locale]/features">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteFrame locale={locale}><FeaturesContent locale={locale} /></SiteFrame>;
}
