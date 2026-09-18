import { notFound, redirect } from "next/navigation";
import { PlatformAdmin, parseAdminView } from "@/components/platform-admin";
import { ServiceError } from "@/components/service-error";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getPlatformOverview } from "@/lib/accounts";
import { getUser } from "@/lib/auth";
import { isLocale, pathFor } from "@/lib/i18n";
import { getPlans } from "@/lib/plans";
import { portalCopy } from "@/lib/portal-copy";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  return isLocale(locale) ? { title: portalCopy(locale).platformOverview } : {};
}

export default async function AdminPage({ params, searchParams }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const view = parseAdminView(query.view);
  const user = await getUser();
  // A signed-in customer who is not a platform operator lands in their own
  // portal instead of a 403 page; the admin link is only shown to operators.
  if (!user) redirect(`${pathFor(locale, "login")}?next=${encodeURIComponent(pathFor(locale, "admin"))}`);
  if (!user.isPlatformAdmin) redirect(pathFor(locale, "portal"));

  let data;
  try {
    const [overview, pricing] = await Promise.all([getPlatformOverview(), getPlans()]);
    data = { ...overview, plans: pricing.plans };
  } catch { return <WorkspaceShell locale={locale} area="admin" active={view} user={user}><ServiceError locale={locale} href={pathFor(locale, "admin")} /></WorkspaceShell>; }

  return <PlatformAdmin locale={locale} view={view} data={data} user={user} />;
}
