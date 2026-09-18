import { notFound } from "next/navigation";
import { Pricing } from "@/components/pricing";
import { SiteFrame } from "@/components/site-frame";
import { isLocale } from "@/lib/i18n";
import { marketingCopy } from "@/lib/marketing-copy";
import { getPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: marketingCopy[locale].nav.pricing, description: marketingCopy[locale].pricing.body };
}

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [pricing, copy] = [await getPlans(), marketingCopy[locale].pricing];
  return <SiteFrame locale={locale}>
    <section className="mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-8 sm:pt-20 lg:px-12">
      <p className="text-sm font-medium text-forest">{copy.eyebrow}</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-normal tracking-tight sm:text-5xl sm:leading-normal">{copy.title}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-9 text-muted">{copy.body}</p>
    </section>
    <section className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12"><Pricing locale={locale} {...pricing} /></section>
  </SiteFrame>;
}
