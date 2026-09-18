import Link from "next/link";
import { Pricing } from "@/components/pricing";
import { formatNumber, pathFor, text, type Locale } from "@/lib/i18n";
import { marketingCopy } from "@/lib/marketing-copy";
import { getPlans } from "@/lib/plans";

const container = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-12";
const primaryLink = "inline-flex min-h-12 items-center justify-center gap-4 rounded-md bg-forest px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink";
const secondaryLink = "inline-flex min-h-12 items-center justify-center gap-3 px-1 py-3 text-sm font-medium text-forest underline decoration-forest/40 underline-offset-8 hover:decoration-forest";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`size-5 shrink-0 rtl:rotate-180 ${className}`}>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

function Check() {
  return <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 shrink-0"><path d="m3 8 3 3 7-7" /></svg>;
}

function ProductSample({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].sample;
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl bg-forest text-white">
      <figcaption className="border-b border-white/25 px-5 py-5 sm:px-7">
        <p className="text-sm font-medium">{copy.label}</p>
        <p className="mt-2 text-xs leading-6 text-mint">{copy.notice}</p>
      </figcaption>
      <div className="px-5 py-6 sm:px-7">
        <div className="flex items-center gap-3 text-sm text-mint">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5"><path d="M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4V5Z" /><path d="M12 7v14" /></svg>
          <span>{copy.channel}</span>
        </div>
        <p className="mt-4 max-w-sm text-lg font-medium leading-8">{copy.post}</p>
        <div className="mt-5 grid grid-cols-3 divide-x divide-forest/20 rounded-md bg-mint text-center text-xs font-medium leading-6 text-forest rtl:divide-x-reverse sm:text-sm">
          {[copy.agree, copy.useful, copy.question].map((label) => <span key={label} className="px-1 py-3">{label}</span>)}
        </div>
      </div>
      <ol className="border-t border-white/25">
        <li className="grid grid-cols-[1.5rem_1fr] gap-4 px-5 py-5 sm:px-7">
          <span className="pt-0.5 text-sm text-mint">{formatNumber(1, locale)}</span>
          <div>
            <h3 className="text-sm font-medium">{copy.gate}</h3>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs leading-6 text-mint">
              {[copy.member, copy.verified, copy.waiting].map((label) => <li key={label} className="flex items-center gap-1.5"><Check />{label}</li>)}
            </ul>
          </div>
        </li>
        <li className="grid grid-cols-[1.5rem_1fr] gap-4 border-t border-white/25 bg-white/5 px-5 py-5 sm:px-7">
          <span className="pt-0.5 text-sm text-mint">{formatNumber(2, locale)}</span>
          <div>
            <h3 className="text-sm font-medium">{copy.evidence}</h3>
            <p className="mt-2 text-xs leading-6 text-mint">{copy.threshold}</p>
            <div aria-hidden="true" className="relative my-4 flex max-w-64 items-center justify-between gap-3">
              <span className="absolute inset-x-0 top-1/2 h-px bg-mint/50" />
              {[1, 2, 3, 4, 5].map((value) => <span key={value} className="relative flex size-6 items-center justify-center rounded-full bg-mint text-xs font-medium text-forest">{formatNumber(value, locale)}</span>)}
            </div>
            <p className="text-xs leading-6">{copy.conclusion}</p>
          </div>
        </li>
        <li className="grid grid-cols-[1.5rem_1fr] gap-4 border-t border-white/25 px-5 py-5 sm:px-7">
          <span className="pt-0.5 text-sm text-mint">{formatNumber(3, locale)}</span>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{copy.review}</h3>
              <span className="rounded-full border border-mint/40 px-3 py-1 text-xs text-mint">{copy.decision}</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-mint">{copy.history}</p>
          </div>
        </li>
      </ol>
    </figure>
  );
}

function Hero({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].hero;
  return (
    <section className={`${container} grid items-center gap-12 pb-16 pt-12 sm:pb-24 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24 lg:pt-20`}>
      <div>
        <p className="mb-7 max-w-sm border-s border-forest ps-4 text-sm leading-7 text-muted">{copy.eyebrow}</p>
        <h1 className={`text-5xl font-semibold tracking-tight sm:text-6xl xl:text-7xl ${locale === "fa" ? "leading-[1.5]" : "leading-[1.1]"}`}>
          <span className="block">{copy.title}</span>
          <span className="block text-forest">{copy.accent}</span>
        </h1>
        <p className="mt-7 max-w-xl text-base leading-8 text-muted sm:text-lg sm:leading-9">{copy.body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link href={pathFor(locale, "preview")} className={primaryLink}>{copy.primary}<Arrow /></Link>
          <Link href={pathFor(locale, "pricing")} className={secondaryLink}>{copy.secondary}</Link>
        </div>
        <p className="mt-7 max-w-md text-xs leading-7 text-muted">{copy.note}</p>
      </div>
      <ProductSample locale={locale} />
    </section>
  );
}

function Mechanism({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].mechanism;
  return (
    <section className="border-y border-line bg-surface py-16 sm:py-24">
      <div className={`${container} grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-24`}>
        <div>
          <h2 className="max-w-lg text-3xl font-semibold leading-normal tracking-tight sm:text-4xl sm:leading-normal">{copy.title}</h2>
          <p className="mt-5 max-w-lg text-base leading-8 text-muted">{copy.body}</p>
          <Link href={pathFor(locale, "features")} className={`${secondaryLink} mt-6`}>{copy.link}<Arrow /></Link>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-5 py-7">
              <span className="text-lg font-medium tabular-nums text-forest">{formatNumber(index + 1, locale)}</span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-8 text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Safety({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].safety;
  return (
    <section className={`${container} grid gap-8 py-16 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-24`}>
      <h2 className="max-w-lg text-3xl font-semibold leading-normal tracking-tight sm:text-4xl sm:leading-normal">{copy.title}</h2>
      <div>
        <p className="text-base leading-9 text-muted">{copy.body}</p>
        <p className="mt-6 border-s border-forest ps-5 text-base font-medium leading-8 text-forest">{copy.aside}</p>
      </div>
    </section>
  );
}

function TelegramLimits({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].limits;
  return (
    <aside className="border-y border-line bg-surface py-14 sm:py-20">
      <div className={`${container} grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-24`}>
        <h2 className="max-w-md text-2xl font-semibold leading-normal sm:text-3xl sm:leading-normal">{copy.title}</h2>
        <div className="space-y-5 text-sm leading-8 text-muted">
          <p>{copy.body}</p>
          <p>{copy.native}</p>
        </div>
      </div>
    </aside>
  );
}

function Closing({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].closing;
  return (
    <section className="bg-mint py-16 sm:py-20">
      <div className={`${container} flex flex-col justify-between gap-8 lg:flex-row lg:items-center lg:gap-16`}>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold leading-normal tracking-tight text-forest sm:text-4xl sm:leading-normal">{copy.title}</h2>
          <p className="mt-4 text-sm leading-8 text-forest">{copy.body}</p>
        </div>
        <Link href={pathFor(locale, "preview")} className={`${primaryLink} shrink-0 self-start lg:self-auto`}>{copy.action}<Arrow /></Link>
      </div>
    </section>
  );
}

export async function HomeContent({ locale }: { locale: Locale }) {
  const pricing = await getPlans();
  const copy = marketingCopy[locale];
  return (
    <>
      <Hero locale={locale} />
      <Mechanism locale={locale} />
      <Safety locale={locale} />
      <section className="border-t border-line bg-canvas py-16 sm:py-24">
        <div className={container}>
          <div className="mb-9 flex flex-col justify-between gap-5 lg:flex-row lg:items-end lg:gap-12">
            <h2 className="max-w-lg text-3xl font-semibold leading-normal tracking-tight sm:text-4xl sm:leading-normal">{copy.pricing.title}</h2>
            <p className="max-w-md text-sm leading-8 text-muted">{copy.pricing.body}</p>
          </div>
          <Pricing locale={locale} {...pricing} compact />
        </div>
      </section>
      <TelegramLimits locale={locale} />
      <Closing locale={locale} />
    </>
  );
}

export function FeaturesContent({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].features;
  return (
    <>
      <section className={`${container} pb-14 pt-14 sm:pb-20 sm:pt-20`}>
        <h1 className="max-w-4xl text-4xl font-semibold leading-normal tracking-tight sm:text-5xl sm:leading-normal">{copy.title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-9 text-muted">{copy.body}</p>
      </section>
      <section aria-label={text(locale, "امکانات دربان", "Darban capabilities")} className={`${container} pb-16 sm:pb-24`}>
        {copy.rows.map((row) => (
          <article key={row.title} className="grid gap-6 border-t border-line py-9 sm:py-12 lg:grid-cols-[0.85fr_1.25fr_0.8fr] lg:gap-10">
            <h2 className="text-2xl font-semibold leading-normal">{row.title}</h2>
            <p className="text-sm leading-8 text-muted">{row.body}</p>
            <div className="border-s border-forest ps-5 lg:self-start">
              <p className="text-xs leading-6 text-muted">{row.label}</p>
              <p className="mt-3 text-sm font-medium leading-8 text-forest">{row.detail}</p>
            </div>
          </article>
        ))}
      </section>
      <Safety locale={locale} />
      <TelegramLimits locale={locale} />
      <Closing locale={locale} />
    </>
  );
}

export function GuideContent({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].guide;
  return (
    <>
      <div className={`${container} grid gap-12 pb-20 pt-14 sm:pb-28 sm:pt-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24`}>
        <div>
          <h1 className="text-4xl font-semibold leading-normal tracking-tight sm:text-5xl sm:leading-normal">{copy.title}</h1>
          <p className="mt-6 text-base leading-9 text-muted">{copy.body}</p>
          <aside className="mt-10 border-y border-line py-7">
            <h2 className="text-lg font-semibold">{copy.before}</h2>
            <p className="mt-3 text-sm leading-8 text-muted">{copy.beforeBody}</p>
            <Link href={pathFor(locale, "login")} className={`${secondaryLink} mt-3`}>{marketingCopy[locale].nav.login}<Arrow /></Link>
          </aside>
          <div className="mt-8">
            <h2 className="text-lg font-semibold">{copy.ready}</h2>
            <p className="mt-3 text-sm leading-8 text-muted">{copy.readyBody}</p>
            <Link href={pathFor(locale, "preview")} className={`${secondaryLink} mt-3`}>{marketingCopy[locale].nav.demo}<Arrow /></Link>
          </div>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-4 py-8 sm:gap-6 sm:py-10">
              <span className="pt-1 text-xl font-medium tabular-nums text-forest">{formatNumber(index + 1, locale)}</span>
              <div>
                <h2 className="text-xl font-semibold leading-8">{step.title}</h2>
                <p className="mt-4 text-sm leading-8 text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <TelegramLimits locale={locale} />
      <Closing locale={locale} />
    </>
  );
}
