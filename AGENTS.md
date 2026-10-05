# AGENTS.md

## Technical decisions

- Self-hosted notifications use ntfy JSON publishing (POST `{topic, title, message}` to the server root derived from `NTFY_URL`), never the plain `Title` HTTP header — the header rejects non-ASCII characters (em dashes in digest titles crash the send).
- The notification scheduler lives in `server/src/notify.js` inside the Express API process (`setInterval`, no new npm dependencies); it only activates when `NTFY_URL` is set and `NTFY_ENABLED=true`. "Today" is computed from `NTFY_TZ_OFFSET` (default +10:00, Melbourne), not the server's UTC clock.
- Notifications are self-hosted only: the hosted Lovable version has no notification feature, by design.
- The self-hosted deployment is served over plain HTTP (Tailscale IP, no TLS), a non-secure browser context: never call `crypto.randomUUID()` or `navigator.clipboard` directly — they are undefined there and crash the UI; use fallbacks.
- All frontend data access goes through `src/lib/data.ts`, which prefixes `VITE_API_URL` — the web UI and API run on different ports, so relative `/api` paths break; UI code never imports the Supabase client directly.
- Self-hosted mode (`SELF_HOSTED`, i.e. `VITE_API_URL` set) stays single-user with no login or auth checks — it has no users table.
- `server/` and `db/schema.sql` stay plain Express + PostgreSQL: no Supabase-specific extensions, roles, grants or RLS — so the stack runs on any stock Postgres.
- `db/schema.sql` is re-run by hand against the live database, so every statement must be idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and must never drop or rewrite existing data.
- After any change to `server/` or `db/schema.sql`, end the reply with an explicit note listing new tables/columns and new environment variables — the owner applies and redeploys these manually on the self-hosted machine.
