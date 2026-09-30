# Plan: ntfy Notifications (Self-Hosted Only)

Daily task digest and overdue nudges delivered to your phone via ntfy, built
into the Express API on danplex. The hosted Lovable version stays untouched —
danplex is where you use the app, and the API is the right home for a scheduler.

## How you'll set it up

1. Install the free **ntfy** app on your iPhone.
2. Subscribe to a private topic (e.g. `dbtasks-danplex-x7k2` — unguessable).
3. Add two lines to the API's environment:
   - `NTFY_URL=https://ntfy.sh/<your-topic>`
   - `NTFY_ENABLED=true`
4. Restart the API container. Notifications flow from then on.

## Behaviour

- **Morning digest** — once a day at a configured time (default 08:00,
  Melbourne timezone via `TZ`), the API checks the database and sends one
  notification listing:
  - Tasks due today (with priority)
  - Tasks scheduled to do today
  - Overdue tasks, flagged prominently
  - Quiet, positive framing when there's nothing to do: "All clear — no tasks
    due today."
- **Overdue escalation** — if any task is overdue and hasn't been mentioned for
  2+ days (i.e. it keeps slipping), the digest marks it "overdue N days" so
  repeat items stand out. Optionally a second short afternoon nudge
  (`NTFY_ESCALATE_AT=15:00`, disabled by default) listing just the overdue
  tasks.
- No notification spam: one digest per day, at most one escalation nudge.

## Technical changes (all server-side; no frontend or database changes)

- **New file `server/src/notify.js`**
  - Lightweight scheduler inside the API process using `setInterval` (checks
    every minute; no new npm dependency).
  - Reads env vars: `NTFY_URL`, `NTFY_ENABLED` (default false), `NTFY_TOKEN`
    (optional, for a protected ntfy server), `NTFY_DIGEST_AT` (default
    `08:00`), `NTFY_ESCALATE_AT` (optional), `NTFY_TZ_OFFSET` (default `+10:00`,
    Melbourne).
  - Date math uses the configured timezone so "today" matches your day, not
    the server's UTC clock (same timezone-safe approach as the overdue pill).
  - Sends via `POST NTFY_URL` with a `Title` header and markdown-ish body;
    logs failures without crashing the API.
- **`server/src/index.js`** — imports and starts the scheduler only when
  `NTFY_URL` is set and `NTFY_ENABLED=true`; also a `GET /api/notify/status`
  endpoint returning whether notifications are on and the last send result
  (handy for checking setup from the browser).
- **`server/.env.example``** — documents the new variables.
- **`SELF_HOSTING.md`** — new "Notifications (ntfy)" section: app setup steps,
  env vars table, example lines, security note (choose an unguessable topic
  name since public ntfy.sh topics are open to anyone who knows the name).
- **`server/package.json`** — no new dependencies.

## What this deliberately does NOT do

- No iOS push / PWA plumbing, no email/SMTP, no hosted-version equivalent.
- No changes to the database schema or the web app's UI.
- Notification settings are env vars only — matching how the rest of your
  self-hosted stack is configured.

## After the build

Changes push to GitHub as usual. On danplex: `git pull`, rebuild the API
container, install the ntfy app + subscribe to your topic, add the env lines,
restart — then wait for the morning digest.
