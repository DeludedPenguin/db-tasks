/**
 * Data layer.
 *
 * Two interchangeable backends:
 *  - Hosted (default): the managed Postgres backend with per-user auth.
 *  - Self-hosted: set VITE_API_URL (e.g. http://localhost:4000) and the app
 *    talks to the thin Express API in /server against your own PostgreSQL.
 *    That mode is single-user and requires no login.
 *
 * Every UI hook goes through this module, so switching backends is a config
 * change, not a code change.
 */
import { supabase } from "@/integrations/supabase/client";

// Untyped view of the client: this module hands it plain rows.
const sb = supabase as any;

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const SELF_HOSTED = API_URL.length > 0;

export type Row = Record<string, any>;

export type BackupFile = {
  format: "db_tasks_backup";
  version: number;
  exported_at: string;
  data: {
    projects: Row[];
    tasks: Row[];
    tags: Row[];
    task_tags: Row[];
    focus_sessions: Row[];
  };
};

// ---- REST helpers ---------------------------------------------------------

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---- Supabase helpers -----------------------------------------------------

async function userId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function unwrap<T>({ data, error }: { data: T; error: any }): T {
  if (error) throw error;
  return data;
}

/** Strips fields the self-hosted schema does not have. */
function stripUser<T extends Row>(row: T): T {
  const { user_id, ...rest } = row as Row;
  return rest as T;
}

// ---- Tasks ----------------------------------------------------------------

export const db = {
  async listTasks(completed: boolean): Promise<Row[]> {
    if (SELF_HOSTED) return api(`/api/tasks?completed=${completed}`);
    return unwrap(
      await supabase
        .from("tasks")
        .select("*, projects(name, color)")
        .eq("user_id", await userId())
        .eq("completed", completed)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
    );
  },

  async listAllTasks(): Promise<Row[]> {
    if (SELF_HOSTED) return api(`/api/tasks`);
    return unwrap(await sb.from("tasks").select("*").eq("user_id", await userId()));
  },

  async createTask(task: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/tasks`, { method: "POST", body: JSON.stringify(stripUser(task)) });
    return unwrap(
      await sb.from("tasks").insert({ ...task, user_id: await userId() }).select().single(),
    );
  },

  async createTasks(tasks: Row[]): Promise<Row[]> {
    if (!tasks.length) return [];
    if (SELF_HOSTED) return api(`/api/tasks`, { method: "POST", body: JSON.stringify(tasks.map(stripUser)) });
    const uid = await userId();
    return unwrap(
      await sb.from("tasks").insert(tasks.map((t) => ({ ...t, user_id: uid }))).select(),
    );
  },

  async updateTask(id: string, updates: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(stripUser(updates)) });
    return unwrap(await sb.from("tasks").update(updates).eq("id", id).select().single());
  },

  async deleteTasks(ids: string[]): Promise<void> {
    if (!ids.length) return;
    if (SELF_HOSTED) {
      await api(`/api/tasks/delete`, { method: "POST", body: JSON.stringify({ ids }) });
      return;
    }
    const { error } = await sb.from("tasks").delete().in("id", ids);
    if (error) throw error;
  },

  // ---- Projects -----------------------------------------------------------

  async listProjects(): Promise<Row[]> {
    if (SELF_HOSTED) return api(`/api/projects`);
    return unwrap(await sb.from("projects").select("*").eq("user_id", await userId()).order("name"));
  },

  async createProject(project: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/projects`, { method: "POST", body: JSON.stringify(stripUser(project)) });
    return unwrap(
      await sb.from("projects").insert({ ...project, user_id: await userId() }).select().single(),
    );
  },

  async createProjects(projects: Row[]): Promise<Row[]> {
    if (!projects.length) return [];
    if (SELF_HOSTED) return api(`/api/projects`, { method: "POST", body: JSON.stringify(projects.map(stripUser)) });
    const uid = await userId();
    return unwrap(
      await sb.from("projects").insert(projects.map((p) => ({ ...p, user_id: uid }))).select(),
    );
  },

  async updateProject(id: string, updates: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    return unwrap(await sb.from("projects").update(updates).eq("id", id).select().single());
  },

  async deleteProject(id: string): Promise<void> {
    if (SELF_HOSTED) return api(`/api/projects/${id}`, { method: "DELETE" });
    const { error } = await sb.from("projects").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- Tags ---------------------------------------------------------------

  async listTags(): Promise<Row[]> {
    if (SELF_HOSTED) return api(`/api/tags`);
    return unwrap(await sb.from("tags").select("*").eq("user_id", await userId()).order("name"));
  },

  async createTag(tag: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/tags`, { method: "POST", body: JSON.stringify(stripUser(tag)) });
    return unwrap(
      await sb.from("tags").insert({ ...tag, user_id: await userId() }).select().single(),
    );
  },

  async updateTag(id: string, updates: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    return unwrap(await sb.from("tags").update(updates).eq("id", id).select().single());
  },

  async deleteTag(id: string): Promise<void> {
    if (SELF_HOSTED) return api(`/api/tags/${id}`, { method: "DELETE" });
    const { error } = await sb.from("tags").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- Task tags ----------------------------------------------------------

  async listTaskTags(taskIds: string[]): Promise<Row[]> {
    if (!taskIds.length) return [];
    if (SELF_HOSTED) return api(`/api/task-tags?task_ids=${taskIds.join(",")}`);
    return unwrap(await sb.from("task_tags").select("*, tags(*)").in("task_id", taskIds));
  },

  async setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
    if (SELF_HOSTED) {
      await api(`/api/tasks/${taskId}/tags`, { method: "PUT", body: JSON.stringify({ tagIds }) });
      return;
    }
    await sb.from("task_tags").delete().eq("task_id", taskId);
    if (tagIds.length) {
      const { error } = await supabase
        .from("task_tags")
        .insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id })));
      if (error) throw error;
    }
  },

  // ---- Focus sessions -----------------------------------------------------

  async listFocusSessions(): Promise<Row[]> {
    if (SELF_HOSTED) return api(`/api/focus-sessions`);
    return unwrap(
      await supabase
        .from("focus_sessions")
        .select("*, tasks(name)")
        .eq("user_id", await userId())
        .order("start_time", { ascending: false }),
    );
  },

  async createFocusSession(session: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/focus-sessions`, { method: "POST", body: JSON.stringify(stripUser(session)) });
    return unwrap(
      await sb.from("focus_sessions").insert({ ...session, user_id: await userId() }).select().single(),
    );
  },

  async createFocusSessions(sessions: Row[]): Promise<Row[]> {
    if (!sessions.length) return [];
    if (SELF_HOSTED) {
      return api(`/api/focus-sessions`, { method: "POST", body: JSON.stringify(sessions.map(stripUser)) });
    }
    const uid = await userId();
    return unwrap(
      await sb.from("focus_sessions").insert(sessions.map((s) => ({ ...s, user_id: uid }))).select(),
    );
  },

  async updateFocusSession(id: string, updates: Row): Promise<Row> {
    if (SELF_HOSTED) return api(`/api/focus-sessions/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    return unwrap(await sb.from("focus_sessions").update(updates).eq("id", id).select().single());
  },

  async deleteFocusSession(id: string): Promise<void> {
    if (SELF_HOSTED) return api(`/api/focus-sessions/${id}`, { method: "DELETE" });
    const { error } = await sb.from("focus_sessions").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- Full JSON backup ---------------------------------------------------

  /** Complete, lossless snapshot of all five tables, including IDs. */
  async exportBackup(): Promise<BackupFile> {
    if (SELF_HOSTED) return api(`/api/backup`);
    const uid = await userId();
    const [projects, tasks, tags, focus_sessions] = await Promise.all([
      sb.from("projects").select("*").eq("user_id", uid).then(unwrap),
      sb.from("tasks").select("*").eq("user_id", uid).then(unwrap),
      sb.from("tags").select("*").eq("user_id", uid).then(unwrap),
      sb.from("focus_sessions").select("*").eq("user_id", uid).then(unwrap),
    ]);
    const taskIds = (tasks ?? []).map((t: Row) => t.id);
    const task_tags = taskIds.length
      ? unwrap(await sb.from("task_tags").select("*").in("task_id", taskIds))
      : [];
    return {
      format: "db_tasks_backup",
      version: 1,
      exported_at: new Date().toISOString(),
      data: {
        projects: (projects ?? []).map(stripUser),
        tasks: (tasks ?? []).map(stripUser),
        tags: (tags ?? []).map(stripUser),
        task_tags: task_tags ?? [],
        focus_sessions: (focus_sessions ?? []).map(stripUser),
      },
    };
  },

  /**
   * Restores a backup. mode "replace" wipes existing rows first; "merge"
   * keeps them and skips rows whose id already exists.
   */
  async importBackup(backup: BackupFile, mode: "merge" | "replace"): Promise<void> {
    if (backup?.format !== "db_tasks_backup") throw new Error("Not a DB_Tasks backup file");
    if (SELF_HOSTED) {
      await api(`/api/backup`, { method: "POST", body: JSON.stringify({ ...backup, mode }) });
      return;
    }
    const uid = await userId();
    const d = backup.data;
    if (mode === "replace") {
      await sb.from("focus_sessions").delete().eq("user_id", uid);
      await sb.from("tasks").delete().eq("user_id", uid);
      await sb.from("tags").delete().eq("user_id", uid);
      await sb.from("projects").delete().eq("user_id", uid);
    }
    const withUser = (rows: Row[] = []) => rows.map((r) => ({ ...stripUser(r), user_id: uid }));
    const upsert = async (table: "projects" | "tags" | "tasks" | "focus_sessions", rows: Row[]) => {
      if (!rows.length) return;
      const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
      if (error) throw error;
    };
    await upsert("projects", withUser(d.projects));
    await upsert("tags", withUser(d.tags));
    await upsert("tasks", withUser(d.tasks));
    await upsert("focus_sessions", withUser(d.focus_sessions));
    if (d.task_tags?.length) {
      const { error } = await sb.from("task_tags").upsert(d.task_tags, { onConflict: "id" });
      if (error) throw error;
    }
  },
};

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
