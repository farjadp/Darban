import { notFound } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { isLocale } from "@/lib/i18n";

export const metadata = { robots: { index: false, follow: false } };
export default async function Login({ params, searchParams }: { params: Promise<{locale:string}>; searchParams: Promise<{next?:string}> }) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return <LoginScreen locale={locale} next={(await searchParams).next} />;
}
