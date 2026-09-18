import { assertSameOrigin, AuthError, authFailure, getAdmin } from "@/lib/auth";
import { getPlatformOverview, mutatePlatform, platformInput, readAccountBody } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    if (!await getAdmin()) throw new AuthError(401, "ابتدا به عنوان مدیر پلتفرم وارد شوید.");
    return Response.json(await getPlatformOverview(), { headers });
  } catch (error) { return authFailure(error, request); }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdmin();
    if (!admin) throw new AuthError(401, "ابتدا به عنوان مدیر پلتفرم وارد شوید.");
    assertSameOrigin(request);
    const parsed = platformInput.safeParse(await readAccountBody(request));
    if (!parsed.success) throw new AuthError(400, "اطلاعات درخواست معتبر نیست.");
    const result = await mutatePlatform(admin.id, parsed.data);
    return Response.json({ ok: true, result }, { headers });
  } catch (error) { return authFailure(error, request); }
}
