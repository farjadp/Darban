import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { LocaleDocument } from "@/components/locale-document";

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <><LocaleDocument locale={locale} />{children}</>;
}
