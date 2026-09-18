"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { pathFor, type Locale } from "@/lib/i18n";
import { marketingCopy, pricePresentation } from "@/lib/marketing-copy";
import type { PlanConfig } from "@/lib/plans";

type PricingProps = {
  locale: Locale;
  plans: PlanConfig[];
  source?: "database" | "defaults";
  unavailable?: boolean;
  compact?: boolean;
};

function money(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function PlanOption({ plan, interval, locale }: { plan: PlanConfig; interval: "monthly" | "annual"; locale: Locale }) {
  const copy = marketingCopy[locale].pricing;
  const quote = pricePresentation(plan, interval);
  const pro = plan.id === "pro";
  const features = locale === "fa" ? plan.featuresFa : plan.featuresEn;

  return (
    <article className={`flex flex-col p-6 sm:p-9 ${pro ? "bg-forest text-white" : "bg-surface text-ink"}`}>
      <div className={`flex items-center justify-between gap-3 border-b pb-6 ${pro ? "border-white/25" : "border-line"}`}>
        <h3 className="text-2xl font-semibold">{pro ? copy.pro : copy.free}</h3>
        <span className={`text-xs ${pro ? "text-mint" : "text-muted"}`}>
          {interval === "annual" ? copy.annual : copy.monthly}
        </span>
      </div>
      <div className="pb-7 pt-8" aria-live="polite" aria-atomic="true">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <bdi className="text-6xl font-medium leading-tight tracking-tight tabular-nums">{money(quote.initialCents, locale)}</bdi>
          <span className={`text-sm ${pro ? "text-mint" : "text-muted"}`}>
            {quote.introductory ? copy.firstYear : interval === "annual" ? copy.perYear : copy.perMonth}
          </span>
        </p>
        <p className={`mt-3 min-h-7 text-sm leading-7 ${pro ? "text-mint" : "text-muted"}`}>
          {quote.introductory ? <>{copy.then} <bdi className="font-semibold">{money(quote.renewalCents, locale)}</bdi> {copy.renewal}</> : !pro ? copy.noCharge : copy.currency}
        </p>
      </div>
      <p className={`text-sm leading-7 ${pro ? "text-mint" : "text-muted"}`}>{copy.pending}</p>
      {features.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold">{copy.configured}</h4>
          <ul className="mt-3 space-y-3 text-sm leading-6">
            {features.map((feature, index) => (
              <li key={`${index}-${feature}`} className="flex items-start gap-3">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mt-1 size-4 shrink-0" stroke="currentColor" strokeWidth="1.5"><path d="m4 10 4 4 8-8" /></svg>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto pt-8">
        {plan.available ? (
          <Link
            href={pathFor(locale, `portal/subscription?plan=${plan.id}&interval=${interval}`)}
            aria-label={`${copy.choose}: ${pro ? copy.pro : copy.free} — ${interval === "annual" ? copy.annual : copy.monthly}`}
            className={`flex min-h-12 items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-colors ${pro ? "bg-mint text-forest hover:bg-white" : "border border-forest text-forest hover:bg-mint"}`}
          >
            {copy.choose}
          </Link>
        ) : (
          <button disabled className={`min-h-12 w-full rounded-md border px-5 py-3 text-sm ${pro ? "border-white/30 text-mint" : "border-line text-muted"}`}>
            {copy.unavailable}
          </button>
        )}
      </div>
    </article>
  );
}

export function Pricing({ locale, plans, source, unavailable = false, compact = false }: PricingProps) {
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const copy = marketingCopy[locale].pricing;
  const noteId = useId();

  return (
    <div className={compact ? "" : "pb-20 sm:pb-28"}>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div role="group" aria-label={copy.interval} className="inline-flex w-fit rounded-lg border border-line bg-surface p-1">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              aria-describedby={noteId}
              onClick={() => setInterval(value)}
              className={`min-h-11 min-w-28 rounded-md px-5 py-2 text-sm font-medium transition-colors ${interval === value ? "bg-forest text-white" : "text-ink hover:bg-canvas"}`}
            >
              {value === "monthly" ? copy.monthly : copy.annual}
            </button>
          ))}
        </div>
        <p className="text-xs leading-6 text-muted">{copy.currency}</p>
      </div>
      {unavailable && <p role="status" className="mb-6 border-s-2 border-forest bg-mint px-5 py-4 text-sm leading-7 text-ink">{copy.reference}</p>}
      {!unavailable && source === "defaults" && <p className="mb-6 text-sm leading-7 text-muted">{copy.defaults}</p>}
      <div className="grid overflow-hidden rounded-xl border border-line md:grid-cols-2">
        {plans.map((plan) => <PlanOption key={plan.id} plan={plan} interval={interval} locale={locale} />)}
      </div>
      {plans.length === 0 && <p role="status" className="border-y border-line py-8 text-muted">{copy.unavailable}</p>}
      <p id={noteId} className="mt-6 max-w-3xl text-sm leading-7 text-muted">{copy.payment}</p>
      {!compact && (
        <div className="mt-12 grid gap-4 border-t border-line pt-8 md:grid-cols-[1fr_2fr] md:gap-12">
          <h2 className="text-xl font-semibold">{copy.terms}</h2>
          <p className="max-w-2xl text-sm leading-8 text-muted">{copy.termsBody}</p>
        </div>
      )}
    </div>
  );
}
