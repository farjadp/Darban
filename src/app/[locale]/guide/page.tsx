import { notFound } from "next/navigation";
import { GuideContent } from "@/components/marketing";
import { SiteFrame } from "@/components/site-frame";
import { isLocale } from "@/lib/i18n";
import { marketingCopy } from "@/lib/marketing-copy";

export async function generateMetadata({ params }: PageProps<"/[locale]/guide">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: marketingCopy[locale].nav.guide, description: marketingCopy[locale].guide.body };
}

export default async function Guide({ params }: PageProps<"/[locale]/guide">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteFrame locale={locale}><GuideContent locale={locale} /></SiteFrame>;
}
