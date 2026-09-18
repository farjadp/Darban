import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ServiceError } from "@/components/service-error";
import { PlanChooser, RequestList } from "@/components/subscription";
import { getAccountOverview } from "@/lib/accounts";
import { isLocale, pathFor } from "@/lib/i18n";
import { getPlans } from "@/lib/plans";
import { planLabel, portalCopy, requestStatusLabel } from "@/lib/portal-copy";
import { portalUser } from "@/lib/portal-session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/portal/subscription">) {
  const { locale } = await params;
  return isLocale(locale) ? { title: portalCopy(locale).subscription } : {};
}

export default async function SubscriptionPage({ params, searchParams }: PageProps<"/[locale]/portal/subscription">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const preselected = { planId: typeof query.plan === "string" ? query.plan : undefined, interval: typeof query.interval === "string" ? query.interval : undefined };
  const user = await portalUser(locale, pathFor(locale, "portal/subscription"));
  const c = portalCopy(locale);

  let overview, pricing;
  try { [overview, pricing] = await Promise.all([getAccountOverview(user.id), getPlans()]); }
  catch { return <WorkspaceShell locale={locale} area="portal" active="subscription" user={user}><ServiceError locale={locale} href={pathFor(locale, "portal/subscription")} /></WorkspaceShell>; }

  const requests = overview.requests.map((request) => ({ ...request, createdAt: request.createdAt.toISOString() }));
  return <WorkspaceShell locale={locale} area="portal" active="subscription" user={user}>
    <div className="min-w-0 space-y-6 wrap-anywhere text-start text-ink">
      <header><h1 className="text-2xl font-bold sm:text-3xl">{c.subscription}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{c.subscriptionDescription}</p></header>
      <div className="rounded-xl border border-line bg-white px-6 py-5"><p className="text-xs text-muted">{c.currentPlan}</p><p className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xl font-semibold">{planLabel(locale, overview.subscription.planId)}</span><span className="rounded-md border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-muted">{requestStatusLabel(locale, overview.subscription.status)}</span></p></div>
      <div role="status" className="rounded-xl border border-emerald-200 bg-mint px-5 py-4 text-sm leading-7 text-forest">{c.paymentNotice}</div>
      <PlanChooser locale={locale} plans={pricing.plans} subscription={overview.subscription} preselected={preselected} disabled={pricing.unavailable} />
      <RequestList locale={locale} requests={requests} />
    </div>
  </WorkspaceShell>;
}
