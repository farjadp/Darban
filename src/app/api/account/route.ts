import { assertSameOrigin, AuthError, authFailure, getUser } from "@/lib/auth";
import { accountInput, getAccountOverview, mutateAccount, readAccountBody } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) throw new AuthError(401, "ابتدا وارد شوید.");
    return Response.json(await getAccountOverview(user.id), { headers });
  } catch (error) { return authFailure(error, request); }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) throw new AuthError(401, "ابتدا وارد شوید.");
    assertSameOrigin(request);
    const parsed = accountInput.safeParse(await readAccountBody(request));
    if (!parsed.success) throw new AuthError(400, "اطلاعات درخواست معتبر نیست.");
    const result = await mutateAccount(user.id, parsed.data);
    return Response.json({ ok: true, charged: false, result }, { headers });
  } catch (error) { return authFailure(error, request); }
}
