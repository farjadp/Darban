# Telegram Guard

## Stack and commands

Next.js 16 App Router, React, TypeScript, Tailwind 4, Prisma 7 with the pg adapter, PostgreSQL. Persian RTL UI with self-hosted Vazirmatn. New agent configuration belongs in .devin/.

- npm ci
- npm run db:generate
- npm test
- npm run typecheck
- npm run lint
- npm run build
- npm run dev -- --port 3100
- npm run db:deploy loads .env and applies migrations to the explicitly configured DATABASE_URL. Obtain approval before touching an existing database.
- npm run guard:setup is read-only inspection of Telegram configuration. npm run guard:setup -- --apply changes the webhook; do not run against a real bot without explicit approval.

## Configuration and deployment

Use .env.example as the template for a local .env; never commit or print secrets. APP_URL must be the public HTTPS origin in production. GUARD_BOT_TOKEN must belong to a dedicated bot, not a content publisher. GUARD_BOT_USERNAME omits @. GUARD_ADMIN_IDS contains comma-separated numeric Telegram user IDs. AUTH_SESSION_SECRET requires at least 32 bytes; GUARD_WEBHOOK_SECRET requires 32–256 ASCII letters, digits, underscores, or hyphens. Configure BotFather /setdomain for the same domain as APP_URL. Admins must start the bot in private before it can send them alerts.

Webhook: /api/channel-guard/telegram. Setup requests message, callback_query, chat_member and my_chat_member updates, max_connections=1, and preserves pending updates. Deploy a persistent HTTPS service with PostgreSQL; allow enough database connections for advisory locks and independently committed audit reservations. Do not use a pool size of one. The start script binds loopback; reverse-proxy it or explicitly supply the deployment hostname.

Native Telegram reactions must be disabled manually in the Telegram client. Publish text through the panel/publishGuardPost to attach controlled vote buttons. Connected discussion groups must be registered separately before linking their gate to a channel.

## Safety and architecture

- No political, religious, identity or belief inference or labels. Do not scrape profiles or use MTProto. Account creation dates and a full subscriber list are not available from Bot API.
- Pure vote rules are in src/lib/channel-guard/protocol.ts; add tests there before connecting new behavior to I/O.
- joinedAt is only populated for membership transitions actually observed in chat_member updates. Existing members keep null and bypass the waiting period. Rejoining resets the observed join date.
- Verification means a private /start interaction, not identity proof. Bans are scoped to a chat and require a human admin's explicit action. Optional comment deletion is a message-level rule explicitly enabled by an admin.
- All admin reads and mutations are allowlisted and scoped by ChatAdmin; selected chat reads and mutations recheck live Telegram admin status. Never authorize from a client-supplied user ID.
- Telegram IDs are strings in storage. Vote rows are recounted under per-chat PostgreSQL advisory locks. Banned members' votes are excluded without deleting the rows; unbanning includes them again.
- One immutable alert snapshot per post: five distinct first-time voters in a 90-second window. Evidence is timing and vote history only. No automatic member removal.
- Telegram and PostgreSQL cannot share an atomic transaction. Persist PENDING before a side effect. UNKNOWN or stranded PENDING needs manual reconciliation; never blindly retry publishing or banning with a new key. Telegram unban does not restore membership or deleted messages.
- Alert delivery is best-effort to one currently authorized configured admin; the database/panel is authoritative. Delivery timeout is not blindly retried. The alert button opens the web review; no bulk-ban callback exists.
- /stats and /who take chat_id first; /ban and /unban require chat_id, user_id and a reason. These commands are explicit admin actions and execute immediately.
- Preview at /preview is public, synthetic and read-only; it must never load real database data or bypass authentication.

## Verification limits

Unit and mocked integration tests cover authentication, CSRF, replay, admin scope, mutations, vote gates, counters and webhook handling. Real Telegram operations and real PostgreSQL migration/concurrency integration need a configured staging environment; mocked tests do not prove those external behaviors. The original local environment had libpq clients but no PostgreSQL server and Docker was stopped.

As of 2026-09-18 npm audit reports four high-severity dependency entries through Prisma 7.10.0, @prisma/config, deepmerge-ts and mysql2, including with --omit=dev. Do not hide the warnings, change security policy, or force-downgrade Prisma to silence them. Resolve compatible upstream updates before production deployment. ESLint 9 is currently pinned because the installed React plugin is incompatible with ESLint 10.
