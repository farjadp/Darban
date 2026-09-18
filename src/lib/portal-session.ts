import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { pathFor, safeReturnPath, type Locale } from "@/lib/i18n";

export async function portalUser(locale: Locale, returnPath = pathFor(locale,"portal")) {
  const user = await getUser();
  if (!user) redirect(`${pathFor(locale,"login")}?next=${encodeURIComponent(safeReturnPath(returnPath,locale))}`);
  return user;
}
