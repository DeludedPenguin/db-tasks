# AGENTS.md

## Technical decisions

- Self-hosted notifications use ntfy JSON publishing (POST `{topic, title, message}` to the server root derived from `NTFY_URL`), never the plain `Title` HTTP header — the header rejects non-ASCII characters (em dashes in digest titles crash the send).
- The notification scheduler lives in `server/src/notify.js` inside the Express API process (`setInterval`, no new npm dependencies); it only activates when `NTFY_URL` is set and `NTFY_ENABLED=true`. "Today" is computed from `NTFY_TZ_OFFSET` (default +10:00, Melbourne), not the server's UTC clock.
- Notifications are self-hosted only: the hosted Lovable version has no notification feature, by design.
