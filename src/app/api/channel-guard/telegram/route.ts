import { NextResponse } from "next/server";
import { handleUpdate } from "@/lib/channel-guard/guard";
import { updateSchema } from "@/lib/channel-guard/input";
import { validWebhookSecret } from "@/lib/channel-guard/webhook-security";
import { limitedJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!validWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await limitedJson(request, 262144); }
  catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  try {
    await handleUpdate(parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Processing unavailable; retry required" }, { status: 503 });
  }
}
