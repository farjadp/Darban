import { pathToFileURL } from "node:url";
import { telegram, TelegramError } from "../src/lib/channel-guard/telegram";

class SetupError extends Error {}
const allowedUpdates = ["message", "callback_query", "chat_member", "my_chat_member"];

function configuration() {
  const token = process.env.GUARD_BOT_TOKEN ?? "";
  const username = process.env.GUARD_BOT_USERNAME ?? "";
  const secret = process.env.GUARD_WEBHOOK_SECRET ?? "";
  const admins = (process.env.GUARD_ADMIN_IDS ?? "").split(",").map(value => value.trim());
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new SetupError("GUARD_BOT_TOKEN is missing or invalid.");
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) || !/bot$/i.test(username)) throw new SetupError("GUARD_BOT_USERNAME must be a valid bot username without @.");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw new SetupError("GUARD_WEBHOOK_SECRET must contain 32–256 ASCII letters, digits, underscores or hyphens.");
  if (admins.some(id => !/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id)))) throw new SetupError("GUARD_ADMIN_IDS must contain numeric Telegram user IDs.");
  if (Buffer.byteLength(process.env.AUTH_SESSION_SECRET ?? "", "utf8") < 32) throw new SetupError("AUTH_SESSION_SECRET must be at least 32 bytes.");
  let app: URL;
  try {
    app = new URL(process.env.APP_URL ?? "");
    if (app.protocol !== "https:" || app.username || app.password || app.search || app.hash || app.pathname !== "/") throw new Error();
  } catch { throw new SetupError("APP_URL must be an HTTPS origin without credentials, a path, query or fragment."); }
  try {
    const database = new URL(process.env.DATABASE_URL ?? "");
    if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname) throw new Error();
  } catch { throw new SetupError("DATABASE_URL must be a PostgreSQL connection URL."); }
  return { token, username, secret, webhookUrl: new URL("/api/channel-guard/telegram", app).href };
}

export async function runSetup(args: string[] = process.argv.slice(2)) {
  if (args.some(arg => arg !== "--apply")) throw new SetupError("Only --apply is supported. Without it, setup performs read-only inspection.");
  const config = configuration();
  const me = await telegram<{ id: number; is_bot: boolean; username: string }>("getMe", {});
  if (!me.is_bot || String(me.id) !== config.token.split(":")[0] || me.username?.toLowerCase() !== config.username.toLowerCase()) throw new SetupError("The token's bot identity does not match GUARD_BOT_USERNAME.");
  const webhook = await telegram<{ url: string; pending_update_count: number; max_connections?: number; allowed_updates?: string[]; last_error_date?: number }>("getWebhookInfo", {});
  const summary = {
    applied: false,
    botUsername: me.username,
    webhookConfigured: Boolean(webhook.url),
    webhookMatches: webhook.url === config.webhookUrl,
    pendingUpdates: webhook.pending_update_count,
    maxConnections: webhook.max_connections ?? null,
    allowedUpdates: webhook.allowed_updates ?? [],
    hasDeliveryError: Boolean(webhook.last_error_date),
  };
  if (!args.includes("--apply")) return summary;
  const applied = await telegram<boolean>("setWebhook", { url: config.webhookUrl, secret_token: config.secret, allowed_updates: allowedUpdates, max_connections: 1 });
  if (applied !== true) throw new SetupError("Telegram did not confirm the webhook configuration. Inspect it manually before rerunning setup.");
  return { ...summary, applied: true, webhookConfigured: true, webhookMatches: true, maxConnections: 1, allowedUpdates };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSetup().then(summary => {
    console.log(JSON.stringify(summary, null, 2));
    console.log(summary.applied ? "Webhook configuration applied; pending updates were preserved." : "Dry run: no configuration changed. Run with --apply only when ready to configure the webhook.");
  }).catch(error => {
    console.error(error instanceof SetupError ? error.message : error instanceof TelegramError ? error.uncertain ? "Telegram response was uncertain. Inspect webhook configuration manually before rerunning setup." : `Telegram rejected the request (code ${error.code}).` : "Setup failed. Check configuration and connectivity; no automatic retry was attempted.");
    process.exitCode = 1;
  });
}
