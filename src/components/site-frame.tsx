import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { pathFor, type Locale } from "@/lib/i18n";
import { marketingCopy } from "@/lib/marketing-copy";

export function SiteHeader({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].nav;
  const links = [["", copy.home], ["features", copy.features], ["pricing", copy.pricing], ["guide", copy.guide]];

  return (
    <header className="border-b border-line bg-canvas lg:sticky lg:top-0 lg:z-30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-forest focus:p-4 focus:text-white">
        {copy.skip}
      </a>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-8 lg:px-12">
        <Brand locale={locale} href={pathFor(locale)} />
        <nav aria-label={copy.label} className="order-3 flex w-full flex-wrap items-center justify-between gap-x-3 border-t border-line pt-2 text-sm lg:order-none lg:w-auto lg:gap-5 lg:border-0 lg:pt-0">
          {links.map(([path, label]) => (
            <Link key={path} href={pathFor(locale, path)} className="inline-flex min-h-11 items-center text-ink underline-offset-8 transition-colors hover:text-forest hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher locale={locale} />
          <Link href={pathFor(locale, "login")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink px-4 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-white">
            {copy.login}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale];
  const links = [["", copy.nav.home], ["features", copy.nav.features], ["pricing", copy.nav.pricing], ["guide", copy.nav.guide], ["preview", copy.nav.demo], ["login", copy.nav.login]];

  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-14 sm:px-8 lg:px-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:gap-16">
          <div className="max-w-sm">
            <Brand locale={locale} href={pathFor(locale)} />
            <p className="mt-5 text-base leading-8 text-mint">{copy.footer.description}</p>
            <p className="mt-2 text-sm text-white">{copy.footer.principle}</p>
          </div>
          <nav aria-label={copy.footer.navigation} className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:gap-x-16">
            {links.map(([path, label]) => (
              <Link key={path} href={pathFor(locale, path)} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-mint hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/25 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs leading-6 text-mint">{copy.footer.independent}</p>
          <LanguageSwitcher locale={locale} variant="dark" />
        </div>
      </div>
    </footer>
  );
}

export function SiteFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div lang={locale} dir={locale === "fa" ? "rtl" : "ltr"} className="min-h-screen bg-canvas text-ink">
      <SiteHeader locale={locale} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
