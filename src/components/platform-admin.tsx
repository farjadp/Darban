import { WorkspaceShell } from "@/components/workspace-shell";
import { AccountStatusButton, PlanEditor } from "@/components/platform-forms";
import { formatDate, formatMoney, formatNumber, type Locale } from "@/lib/i18n";
import type { PlatformOverview } from "@/lib/platform-sample";
import { planLabel, platformActionLabel, portalCopy, requestStatusLabel } from "@/lib/portal-copy";

export const adminViews = ["overview", "users", "plans", "requests", "events"] as const;
export type AdminView = (typeof adminViews)[number];
export function parseAdminView(value: string | string[] | undefined): AdminView {
  return adminViews.includes(value as AdminView) ? (value as AdminView) : "overview";
}

type Props = { locale: Locale; view: AdminView; data: PlatformOverview; user: { id: string; name: string; isPlatformAdmin?: boolean }; preview?: boolean };

const cell = "px-4 py-4 align-top";
const head = "border-y border-line bg-canvas text-xs text-muted";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="space-y-5"><div><h2 className="text-xl font-semibold">{title}</h2>{description && <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{description}</p>}</div>{children}</section>;
}

function Status({ locale, value }: { locale: Locale; value: string }) {
  const c = portalCopy(locale);
  const tone = value === "ACTIVE" || value === "APPROVED" ? "border-emerald-200 bg-mint text-forest" : value === "SUSPENDED" || value === "REJECTED" ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-canvas text-muted";
  const label = value === "ACTIVE" ? c.active : value === "SUSPENDED" ? c.suspended : requestStatusLabel(locale, value);
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}

function Accounts({ locale, data, user, disabled }: Props & { disabled: boolean }) {
  const c = portalCopy(locale);
  if (!data.accounts.length) return <p className="rounded-xl border border-line bg-white px-6 py-8 text-sm text-muted">{c.noAccounts}</p>;
  return <div className="max-w-full overflow-x-auto rounded-xl border border-line bg-white" role="region" aria-label={c.users} tabIndex={0}><table className="w-full min-w-[760px] text-start text-sm"><caption className="sr-only">{c.users}</caption>
    <thead className={head}><tr>{[c.name, c.plan, c.status, c.memberSince, c.action].map((label) => <th key={label} scope="col" className="px-4 py-4 text-start font-medium">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-line">{data.accounts.map((account) => <tr key={account.id}>
      <td className={cell}><bdi className="font-medium">{account.name}</bdi><bdi dir="ltr" className="mt-1 block w-fit font-mono text-xs text-muted">{account.id}</bdi></td>
      <td className={cell}>{planLabel(locale, account.subscription?.planId ?? "free")}<span className="mt-1 block text-xs text-muted">{requestStatusLabel(locale, account.subscription?.status ?? "FREE")}</span></td>
      <td className={cell}><Status locale={locale} value={account.status} /></td>
      <td className={`${cell} whitespace-nowrap text-xs leading-7`}>{formatDate(account.createdAt, locale)}</td>
      <td className={cell}>{account.id === user.id ? <span className="text-xs text-muted">{c.platformAdminBadge}</span> : <AccountStatusButton locale={locale} accountId={account.id} status={account.status} disabled={disabled} />}</td>
    </tr>)}</tbody></table></div>;
}

function Requests({ locale, data }: Props) {
  const c = portalCopy(locale);
  if (!data.requests.length) return <p className="rounded-xl border border-line bg-white px-6 py-8 text-sm text-muted">{c.noPlatformRequests}</p>;
  return <div className="max-w-full overflow-x-auto rounded-xl border border-line bg-white" role="region" aria-label={c.planRequests} tabIndex={0}><table className="w-full min-w-[760px] text-start text-sm"><caption className="sr-only">{c.planRequests}</caption>
    <thead className={head}><tr>{[c.name, c.plan, c.amount, c.status, c.createdAt].map((label) => <th key={label} scope="col" className="px-4 py-4 text-start font-medium">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-line">{data.requests.map((request) => <tr key={request.id}>
      <td className={cell}><bdi className="font-medium">{request.account.name}</bdi><bdi dir="ltr" className="mt-1 block w-fit font-mono text-xs text-muted">{request.accountId}</bdi></td>
      <td className={cell}>{planLabel(locale, request.planId)}<span className="mt-1 block text-xs text-muted">{request.interval === "annual" ? c.annual : c.monthly}</span></td>
      <td className={`${cell} tabular-nums`}><bdi>{formatMoney(request.initialCents, locale, request.currency)}</bdi><span className="mt-1 block text-xs text-muted">{c.renewal}: <bdi>{formatMoney(request.renewalCents, locale, request.currency)}</bdi></span></td>
      <td className={cell}><Status locale={locale} value={request.status} /></td>
      <td className={`${cell} whitespace-nowrap text-xs leading-7`}>{formatDate(request.createdAt, locale)}</td>
    </tr>)}</tbody></table></div>;
}

function Events({ locale, data }: Props) {
  const c = portalCopy(locale);
  if (!data.events.length) return <p className="rounded-xl border border-line bg-white px-6 py-8 text-sm text-muted">{c.noEvents}</p>;
  return <div className="max-w-full overflow-x-auto rounded-xl border border-line bg-white" role="region" aria-label={c.auditLog} tabIndex={0}><table className="w-full min-w-[720px] text-start text-sm"><caption className="sr-only">{c.auditLog}</caption>
    <thead className={head}><tr>{[c.action, c.actor, c.target, c.detail, c.createdAt].map((label) => <th key={label} scope="col" className="px-4 py-4 text-start font-medium">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-line">{data.events.map((event) => <tr key={event.id}>
      <td className={`${cell} font-medium`}>{platformActionLabel(locale, event.action)}</td>
      <td className={cell}><bdi dir="ltr" className="font-mono text-xs">{event.actorId}</bdi></td>
      <td className={cell}><bdi dir="ltr" className="font-mono text-xs">{event.targetId ?? "—"}</bdi></td>
      <td className={`${cell} max-w-sm`}><pre dir="ltr" className="whitespace-pre-wrap break-all text-start font-mono text-xs leading-6 text-muted">{JSON.stringify(event.detailJson)?.slice(0, 400)}</pre></td>
      <td className={`${cell} whitespace-nowrap text-xs leading-7`}>{formatDate(event.createdAt, locale)}</td>
    </tr>)}</tbody></table></div>;
}

export function PlatformAdmin(props: Props) {
  const { locale, view, data, user, preview = false } = props;
  const c = portalCopy(locale);
  const disabled = preview;
  const titles: Record<AdminView, [string, string]> = { overview: [c.platformOverview, c.platformDescription], users: [c.users, c.usersDescription], plans: [c.plans, c.plansDescription], requests: [c.planRequests, c.planRequestsDescription], events: [c.auditLog, c.auditDescription] };
  const pending = data.requests.filter((request) => request.status === "PENDING").length;
  const suspended = data.accounts.filter((account) => account.status === "SUSPENDED").length;

  return <WorkspaceShell locale={locale} area="admin" active={view} user={user} preview={preview}>
    <div className="min-w-0 space-y-8 wrap-anywhere text-start text-ink">
      <header><h1 className="text-2xl font-bold sm:text-3xl">{titles[view][0]}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{titles[view][1]}</p></header>

      {view === "overview" && <>
        <dl className="grid divide-y divide-line rounded-xl border border-line bg-white sm:grid-cols-3 sm:divide-y-0">
          {[[c.users, data.accounts.length], [c.planRequests, pending], [c.suspended, suspended]].map(([label, value]) => <div key={String(label)} className="px-6 py-5 sm:border-s sm:border-line first:sm:border-s-0"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{formatNumber(Number(value), locale)}</dd></div>)}
        </dl>
        <Section title={c.planRequests} description={c.planRequestsDescription}><Requests {...props} /></Section>
        <Section title={c.auditLog}><Events {...props} /></Section>
      </>}
      {view === "users" && <Accounts {...props} disabled={disabled} />}
      {view === "plans" && <div className="grid gap-6 lg:grid-cols-2">{data.plans.map((plan) => <PlanEditor key={`${plan.id}-${plan.monthlyCents}-${plan.annualCents}-${plan.introAnnualCents}-${plan.available}`} locale={locale} plan={plan} disabled={disabled} />)}</div>}
      {view === "requests" && <Requests {...props} />}
      {view === "events" && <Events {...props} />}

      <footer className="flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-xs leading-6 text-muted"><p>{preview ? c.sampleNotice : c.paymentNotice}</p><p>{c.timezone}</p></footer>
    </div>
  </WorkspaceShell>;
}
