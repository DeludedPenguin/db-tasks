import express from "express";
import cors from "cors";
import { query, withTransaction, pool } from "./db.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

const origin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: origin === "*" ? true : origin.split(",").map((s) => s.trim()) }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// ---- helpers -------------------------------------------------------------

const TASK_FIELDS = [
  "name", "completed", "do_date", "due_date", "priority", "project_id", "notes",
  "created_at", "completed_at",
];
const PROJECT_FIELDS = ["name", "color", "created_at"];
const TAG_FIELDS = ["name", "color", "created_at"];
const SESSION_FIELDS = [
  "start_time", "end_time", "planned_minutes", "actual_minutes", "notes", "task_id", "date",
];

function pick(body, fields, { withId = false } = {}) {
  const out = {};
  if (withId && body.id) out.id = body.id;
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

async function insertRow(table, values, client) {
  const keys = Object.keys(values);
  if (keys.length === 0) throw new Error(`No fields to insert into ${table}`);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const params = keys.map((k) => values[k]);
  const res = client ? await client.query(sql, params) : { rows: await query(sql, params) };
  return res.rows[0];
}

async function updateRow(table, id, values) {
  const keys = Object.keys(values);
  if (keys.length === 0) {
    const [row] = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return row;
  }
  const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
  const rows = await query(
    `UPDATE ${table} SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...keys.map((k) => values[k])],
  );
  return rows[0];
}

// ---- health --------------------------------------------------------------

app.get("/api/health", wrap(async (_req, res) => {
  const [row] = await query("SELECT now() AS now");
  res.json({ ok: true, time: row.now });
}));

// ---- tasks ---------------------------------------------------------------

app.get("/api/tasks", wrap(async (req, res) => {
  const params = [];
  let where = "";
  if (req.query.completed !== undefined) {
    params.push(req.query.completed === "true");
    where = `WHERE t.completed = $1`;
  }
  const rows = await query(
    `SELECT t.*, CASE WHEN p.id IS NULL THEN NULL
        ELSE json_build_object('name', p.name, 'color', p.color) END AS projects
     FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
     ${where}
     ORDER BY t.priority DESC, t.created_at DESC`,
    params,
  );
  res.json(rows);
}));

app.post("/api/tasks", wrap(async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const rows = await withTransaction(async (client) => {
    const out = [];
    for (const item of payload) out.push(await insertRow("tasks", pick(item, TASK_FIELDS), client));
    return out;
  });
  res.status(201).json(Array.isArray(req.body) ? rows : rows[0]);
}));

app.patch("/api/tasks/:id", wrap(async (req, res) => {
  const row = await updateRow("tasks", req.params.id, pick(req.body, TASK_FIELDS));
  if (!row) return res.status(404).json({ error: "Task not found" });
  res.json(row);
}));

app.delete("/api/tasks/:id", wrap(async (req, res) => {
  await query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
  res.status(204).end();
}));

// Bulk delete (ids in body so long lists never hit URL limits)
app.post("/api/tasks/delete", wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length) await query("DELETE FROM tasks WHERE id = ANY($1::uuid[])", [ids]);
  res.status(204).end();
}));

// ---- projects / tags -----------------------------------------------------

for (const [route, table, fields] of [
  ["projects", "projects", PROJECT_FIELDS],
  ["tags", "tags", TAG_FIELDS],
]) {
  app.get(`/api/${route}`, wrap(async (_req, res) => {
    res.json(await query(`SELECT * FROM ${table} ORDER BY name`));
  }));

  app.post(`/api/${route}`, wrap(async (req, res) => {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const rows = await withTransaction(async (client) => {
      const out = [];
      for (const item of payload) out.push(await insertRow(table, pick(item, fields), client));
      return out;
    });
    res.status(201).json(Array.isArray(req.body) ? rows : rows[0]);
  }));

  app.patch(`/api/${route}/:id`, wrap(async (req, res) => {
    const row = await updateRow(table, req.params.id, pick(req.body, fields));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  }));

  app.delete(`/api/${route}/:id`, wrap(async (req, res) => {
    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  }));
}

// ---- task tags -----------------------------------------------------------

app.get("/api/task-tags", wrap(async (req, res) => {
  const ids = String(req.query.task_ids || "").split(",").filter(Boolean);
  if (!ids.length) return res.json([]);
  const rows = await query(
    `SELECT tt.id, tt.task_id, tt.tag_id,
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color,
                              'created_at', tg.created_at) AS tags
     FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id
     WHERE tt.task_id = ANY($1::uuid[])`,
    [ids],
  );
  res.json(rows);
}));

app.put("/api/tasks/:id/tags", wrap(async (req, res) => {
  const tagIds = Array.isArray(req.body?.tagIds) ? req.body.tagIds : [];
  await withTransaction(async (client) => {
    await client.query("DELETE FROM task_tags WHERE task_id = $1", [req.params.id]);
    for (const tagId of tagIds) {
      await client.query(
        `INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)
         ON CONFLICT (task_id, tag_id) DO NOTHING`,
        [req.params.id, tagId],
      );
    }
  });
  res.status(204).end();
}));

// ---- focus sessions ------------------------------------------------------

app.get("/api/focus-sessions", wrap(async (_req, res) => {
  const rows = await query(
    `SELECT f.*, CASE WHEN t.id IS NULL THEN NULL
        ELSE json_build_object('name', t.name) END AS tasks
     FROM focus_sessions f LEFT JOIN tasks t ON t.id = f.task_id
     ORDER BY f.start_time DESC`,
  );
  res.json(rows);
}));

app.post("/api/focus-sessions", wrap(async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const rows = await withTransaction(async (client) => {
    const out = [];
    for (const item of payload) {
      out.push(await insertRow("focus_sessions", pick(item, SESSION_FIELDS), client));
    }
    return out;
  });
  res.status(201).json(Array.isArray(req.body) ? rows : rows[0]);
}));

app.patch("/api/focus-sessions/:id", wrap(async (req, res) => {
  const row = await updateRow("focus_sessions", req.params.id, pick(req.body, SESSION_FIELDS));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));

app.delete("/api/focus-sessions/:id", wrap(async (req, res) => {
  await query("DELETE FROM focus_sessions WHERE id = $1", [req.params.id]);
  res.status(204).end();
}));

// ---- full JSON backup ----------------------------------------------------

app.get("/api/backup", wrap(async (_req, res) => {
  const [projects, tasks, tags, task_tags, focus_sessions] = await Promise.all([
    query("SELECT * FROM projects ORDER BY created_at"),
    query("SELECT * FROM tasks ORDER BY created_at"),
    query("SELECT * FROM tags ORDER BY created_at"),
    query("SELECT * FROM task_tags"),
    query("SELECT * FROM focus_sessions ORDER BY start_time"),
  ]);
  res.json({
    format: "db_tasks_backup",
    version: 1,
    exported_at: new Date().toISOString(),
    data: { projects, tasks, tags, task_tags, focus_sessions },
  });
}));

// mode=replace wipes everything first; mode=merge (default) keeps existing rows
app.post("/api/backup", wrap(async (req, res) => {
  const body = req.body || {};
  if (body.format !== "db_tasks_backup") {
    return res.status(400).json({ error: "Not a DB_Tasks backup file" });
  }
  const data = body.data || {};
  const mode = body.mode === "replace" ? "replace" : "merge";
  const counts = await withTransaction(async (client) => {
    if (mode === "replace") {
      await client.query("TRUNCATE task_tags, focus_sessions, tasks, tags, projects CASCADE");
    }
    const inserted = { projects: 0, tags: 0, tasks: 0, task_tags: 0, focus_sessions: 0 };
    const ins = async (table, rows, fields) => {
      for (const row of rows ?? []) {
        const values = pick(row, fields, { withId: true });
        const keys = Object.keys(values);
        const cols = keys.map((k) => `"${k}"`).join(", ");
        const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO ${table} (${cols}) VALUES (${ph}) ON CONFLICT (id) DO NOTHING`,
          keys.map((k) => values[k]),
        );
        inserted[table]++;
      }
    };
    await ins("projects", data.projects, PROJECT_FIELDS);
    await ins("tags", data.tags, TAG_FIELDS);
    await ins("tasks", data.tasks, TASK_FIELDS);
    for (const row of data.task_tags ?? []) {
      await client.query(
        `INSERT INTO task_tags (id, task_id, tag_id) VALUES (COALESCE($1, gen_random_uuid()), $2, $3)
         ON CONFLICT DO NOTHING`,
        [row.id ?? null, row.task_id, row.tag_id],
      );
      inserted.task_tags++;
    }
    await ins("focus_sessions", data.focus_sessions, SESSION_FIELDS);
    return inserted;
  });
  res.json({ ok: true, mode, counts });
}));

// ---- errors --------------------------------------------------------------

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.log(`DB_Tasks API listening on :${port}`));

const shutdown = async () => {
  server.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
