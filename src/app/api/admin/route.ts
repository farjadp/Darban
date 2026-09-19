import { assertSameOrigin, AuthError, getUser } from "@/lib/auth";
import { GuardError } from "@/lib/channel-guard/access";
import { attachPost, connectChat, moderateMember, publishGuardPost, reviewAlert, saveSettings, syncPost } from "@/lib/channel-guard/actions";
import { adminInput } from "@/lib/channel-guard/input";
import { PHOTO_LIMIT, readPhoto } from "@/lib/channel-guard/media";
import type { PostPhoto } from "@/lib/channel-guard/actions";
import { TelegramError } from "@/lib/channel-guard/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A publish may arrive as multipart because it carries a photo; everything else
 * stays JSON. The fields are read into the same shape either way, so validation
 * and the idempotency key do not care which transport was used.
 */
async function readMultipart(request: Request): Promise<{ input: unknown; photo: PostPhoto | null }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PHOTO_LIMIT + 64 * 1024) throw new GuardError("حجم درخواست بیش از حد مجاز است.", 413);
  let form: FormData;
  try { form = await request.formData(); }
  catch { throw new GuardError("بدنه درخواست معتبر نیست.", 400); }
  const field = (name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };
  return {
    input: { operation: "publish", chatId: field("chatId"), text: field("text").trim(), requestId: field("requestId") },
    photo: await readPhoto(form.get("photo")),
  };
}

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new GuardError("نوع درخواست باید JSON باشد.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new GuardError("بدنه درخواست خالی است.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) {
        await reader.cancel().catch(() => undefined);
        throw new GuardError("حجم درخواست بیش از حد مجاز است.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof GuardError) throw error;
    throw new GuardError("بدنه درخواست معتبر نیست.", 400);
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const admin = await getUser();
    if (!admin) throw new AuthError(401, "ابتدا وارد شوید.");
    assertSameOrigin(request);
    const multipart = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "multipart/form-data";
    const submitted = multipart ? await readMultipart(request) : { input: await readBody(request), photo: null };
    const parsed = adminInput.safeParse(submitted.input);
    if (!parsed.success) throw new GuardError("اطلاعات درخواست معتبر نیست.", 400);
    const input = parsed.data;
    if (multipart && input.operation !== "publish") throw new GuardError("اطلاعات درخواست معتبر نیست.", 400);
    let result: unknown;
    switch (input.operation) {
      case "connect": result = await connectChat(input.chatId, admin.id); break;
      case "publish": result = await publishGuardPost(input, admin.id, submitted.photo ?? undefined); break;
      case "moderate": result = await moderateMember(input, admin.id); break;
      case "settings": result = await saveSettings(input, admin.id); break;
      case "review": result = await reviewAlert(input, admin.id); break;
      case "sync": result = await syncPost(input, admin.id); break;
      case "attach": result = await attachPost(input, admin.id); break;
    }
    return Response.json({ ok: true, result }, { headers });
  } catch (error) {
    if (error instanceof GuardError || error instanceof AuthError) return Response.json({ ok: false, error: error.message }, { status: error.status, headers });
    if (error instanceof TelegramError) return Response.json({ ok: false, error: error.message, detail: error.description || undefined, uncertain: error.uncertain }, { status: error.uncertain ? 409 : error.code === 429 ? 429 : 502, headers });
    return Response.json({ ok: false, error: "سرویس در دسترس نیست؛ پیش از تکرار، وضعیت عملیات را بررسی کنید." }, { status: 503, headers });
  }
}
