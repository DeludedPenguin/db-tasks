# Self-hosting DB_Tasks

Everything you need to run DB_Tasks on your own machine against your own
PostgreSQL database, with no login and no managed services.

Three pieces:

1. **PostgreSQL** — your own instance (bare metal, Docker, whatever you already run).
2. **`server/`** — a thin Express API using a `pg` connection pool, configured entirely
   from environment variables.
3. **The web app** — the same React build, pointed at the API with `VITE_API_URL`.

---

## 1. Create the database

```bash
createdb dbtasks
psql -d dbtasks -f db/schema.sql
```

`db/schema.sql` is plain DDL: five tables (`projects`, `tasks`, `tags`, `task_tags`,
`focus_sessions`), no row-level security, no roles or grants, no extensions beyond
what PostgreSQL 13+ ships with. It is safe to re-run.

There is no `user_id` column — the self-hosted setup is single-user by design.

## 2. Run the API

```bash
cd server
cp .env.example .env      # fill in your database details
npm install
npm start
```

Environment variables:

| Variable      | Default     | Purpose                                    |
| ------------- | ----------- | ------------------------------------------ |
| `DB_HOST`     | `localhost` | PostgreSQL host                            |
| `DB_PORT`     | `5432`      | PostgreSQL port                            |
| `DB_NAME`     | `dbtasks`   | Database name                              |
| `DB_USER`     | `dbtasks`   | Database user                              |
| `DB_PASSWORD` | —           | Database password                          |
| `DB_POOL_MAX` | `10`        | Max pooled connections                     |
| `PORT`        | `4000`      | Port the API listens on                    |
| `CORS_ORIGIN` | `*`         | Allowed browser origins, comma-separated   |

Check it: `curl http://localhost:4000/api/health`

`npm run migrate` applies `db/schema.sql` through the same connection settings if you
would rather not use `psql`.

## 3. Point the web app at the API

Create `.env.local` in the project root:

```
VITE_API_URL=http://localhost:4000
```

Then `npm run build` and serve `dist/` with any static file server (nginx, Caddy,
`npx serve dist`).

When `VITE_API_URL` is set the app runs in self-hosted mode: every read and write goes
to your API, and the login screen is skipped entirely. When it is unset the app behaves
exactly as it does today on the hosted backend. All of that lives in `src/lib/data.ts` —
one file, two backends.

## Docker

`server/Dockerfile` builds the API alone. `docker-compose.yml` brings up PostgreSQL plus
the API together:

```bash
DB_PASSWORD=your-password docker compose up -d --build
```

The compose file loads `db/schema.sql` on first start and keeps data in the `db-data`
volume. The API is published on `${API_PORT:-4000}`.

To run only the API against a database you already have:

```bash
docker build -f server/Dockerfile -t db-tasks-api .
docker run -d -p 4000:4000 \
  -e DB_HOST=host.docker.internal -e DB_NAME=dbtasks \
  -e DB_USER=dbtasks -e DB_PASSWORD=your-password \
  db-tasks-api
```

## Moving your existing data across

1. In the hosted app, open **Import & Export → Full Backup (JSON) → Download Backup**.
   That file contains all five tables with their original IDs and relationships.
2. Start the self-hosted stack and open it in your browser.
3. **Import & Export → Select Backup File**, pick the JSON, then **Replace everything**.

Do the same in reverse any time you want a complete, re-importable backup. The CSV
exports are still there for spreadsheet work, but they are lossy — the JSON backup is
the one to keep.

You can also back up straight from the API:

```bash
curl http://localhost:4000/api/backup > db-tasks-backup.json
curl -X POST http://localhost:4000/api/backup \
  -H 'Content-Type: application/json' \
  --data-binary @db-tasks-backup.json
```

…or just use `pg_dump`, since it is your database.

## A note on security

Self-hosted mode has no authentication: anyone who can reach the API can read and
change everything. Keep it on `localhost` or a trusted home network, or put it behind a
reverse proxy with its own auth before exposing it to the internet.

## API reference

| Method | Path                       | Purpose                                  |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | `/api/health`              | Liveness + database check                |
| GET    | `/api/tasks?completed=`    | Tasks with their project                 |
| POST   | `/api/tasks`               | Create one task or an array of tasks     |
| PATCH  | `/api/tasks/:id`           | Update a task                            |
| POST   | `/api/tasks/delete`        | Bulk delete `{ ids: [...] }`             |
| PUT    | `/api/tasks/:id/tags`      | Replace a task's tags `{ tagIds: [...] }`|
| GET    | `/api/task-tags?task_ids=` | Tag links for the given tasks            |
| —      | `/api/projects`, `/api/tags` | GET / POST / PATCH `:id` / DELETE `:id` |
| —      | `/api/focus-sessions`      | GET / POST / PATCH `:id` / DELETE `:id`  |
| GET    | `/api/backup`              | Full JSON backup                         |
| POST   | `/api/backup`              | Restore (`mode`: `merge` or `replace`)   |
