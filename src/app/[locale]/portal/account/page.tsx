import { notFound } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { ServiceError } from "@/components/service-error";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAccountOverview } from "@/lib/accounts";
import { formatDate, isLocale, pathFor } from "@/lib/i18n";
import { portalCopy } from "@/lib/portal-copy";
import { portalUser } from "@/lib/portal-session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/portal/account">) {
  const { locale } = await params;
  return isLocale(locale) ? { title: portalCopy(locale).account } : {};
}

export default async function AccountPage({ params }: PageProps<"/[locale]/portal/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await portalUser(locale, pathFor(locale, "portal/account"));
  const c = portalCopy(locale);

  let overview;
  try { overview = await getAccountOverview(user.id); }
  catch { return <WorkspaceShell locale={locale} area="portal" active="account" user={user}><ServiceError locale={locale} href={pathFor(locale, "portal/account")} /></WorkspaceShell>; }

  const { account } = overview;
  return <WorkspaceShell locale={locale} area="portal" active="account" user={user}>
    <div className="min-w-0 space-y-6 wrap-anywhere text-start text-ink">
      <header><h1 className="text-2xl font-bold sm:text-3xl">{c.account}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{c.accountDescription}</p></header>
      <dl className="grid divide-y divide-line rounded-xl border border-line bg-white sm:grid-cols-3 sm:divide-y-0">
        <div className="px-6 py-5"><dt className="text-xs text-muted">{c.displayName}</dt><dd className="mt-1 font-semibold"><bdi>{account.name}</bdi></dd><dd className="mt-2 text-xs leading-6 text-muted">{c.displayNameHelp}</dd></div>
        <div className="px-6 py-5 sm:border-s sm:border-line"><dt className="text-xs text-muted">{c.telegramId}</dt><dd className="mt-1 font-mono font-semibold"><bdi dir="ltr">{account.id}</bdi></dd></div>
        <div className="px-6 py-5 sm:border-s sm:border-line"><dt className="text-xs text-muted">{c.memberSince}</dt><dd className="mt-1 font-semibold">{formatDate(account.createdAt, locale)}</dd></div>
      </dl>
      <AccountForm locale={locale} currentLocale={account.locale === "en" ? "en" : "fa"} />
    </div>
  </WorkspaceShell>;
}
