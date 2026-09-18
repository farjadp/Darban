import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ServiceError } from "@/components/service-error";
import { loadDashboard, parseView } from "@/lib/dashboard";
import { isLocale, pathFor } from "@/lib/i18n";
import { portalUser } from "@/lib/portal-session";

export const dynamic = "force-dynamic";
export default async function Portal({params,searchParams}: {params:Promise<{locale:string}>;searchParams:Promise<{view?:string;chat?:string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const selected = new URLSearchParams();
  if(typeof query.view === "string") selected.set("view",query.view);
  if(typeof query.chat === "string") selected.set("chat",query.chat);
  const user = await portalUser(locale,`${pathFor(locale,"portal")}?${selected}`);
  let data;
  try { data = await loadDashboard(user.id,typeof query.chat === "string" ? query.chat : undefined); }
  catch { return <WorkspaceShell locale={locale} area="portal" active="overview" user={user}><ServiceError locale={locale}/></WorkspaceShell>; }
  const ready = ["APP_URL","GUARD_BOT_TOKEN","GUARD_BOT_USERNAME","GUARD_WEBHOOK_SECRET","AUTH_SESSION_SECRET","DATABASE_URL"].every(key=>Boolean(process.env[key]?.trim()));
  return <Dashboard locale={locale} data={data} view={parseView(query.view)} admin={user} configurationReady={ready}/>;
}
