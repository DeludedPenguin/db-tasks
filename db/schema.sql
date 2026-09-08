-- DB_Tasks — plain PostgreSQL schema (self-hosted, single user, no auth)
-- Apply with:  psql -h localhost -U dbtasks -d dbtasks -f db/schema.sql
-- No RLS, no roles/grants, no Supabase-specific extensions.
-- UUID defaults use gen_random_uuid(), built into PostgreSQL 13+.

CREATE TABLE IF NOT EXISTS projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#3498db',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT false,
  do_date      DATE,
  due_date     DATE,
  priority     INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 3),
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_tags (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (task_id, tag_id)
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time        TIMESTAMPTZ,
  planned_minutes INTEGER NOT NULL,
  actual_minutes  INTEGER,
  notes           TEXT,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  date            DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS tasks_completed_idx      ON tasks (completed);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx     ON tasks (project_id);
CREATE INDEX IF NOT EXISTS task_tags_task_id_idx    ON task_tags (task_id);
CREATE INDEX IF NOT EXISTS task_tags_tag_id_idx     ON task_tags (tag_id);
CREATE INDEX IF NOT EXISTS focus_sessions_start_idx ON focus_sessions (start_time DESC);
