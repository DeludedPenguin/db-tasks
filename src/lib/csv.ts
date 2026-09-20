// CSV parsing and generation utilities

// Parses the whole file as one character stream (RFC 4180 aware): a quoted
// field may contain literal newlines, commas, and escaped `""` quotes, so
// splitting on `\n` before parsing (the previous approach) shreds any row
// with a multi-line quoted field — e.g. pasted notes — into multiple
// mis-aligned rows, shifting every later column left.
//
// delimiter defaults to comma but can be overridden (e.g. ";" for Todoist's
// semicolon-delimited exports).
export function parseCSV(text: string, delimiter = ","): Record<string, string>[] {
  const rows = parseCSVRows(text, delimiter);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] ?? "").trim()));
    return row;
  });
}

// Best-effort delimiter sniff: count unquoted commas vs semicolons in the
// header line. Todoist's own export is semicolon-delimited by design.
function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCSVRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  let rowHasContent = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      rowHasContent = true;
    } else if (ch === delimiter) {
      row.push(current);
      current = "";
      rowHasContent = true;
    } else if (ch === "\r") {
      // Skip bare CR; the following \n (if any) ends the row.
      continue;
    } else if (ch === "\n") {
      row.push(current);
      current = "";
      if (rowHasContent || row.some((v) => v.trim())) rows.push(row);
      row = [];
      rowHasContent = false;
    } else {
      current += ch;
      rowHasContent = true;
    }
  }

  // Flush the final field/row if the file doesn't end with a newline.
  if (current.length > 0 || rowHasContent) {
    row.push(current);
    if (row.some((v) => v.trim())) rows.push(row);
  }

  return rows;
}

export function toCSV(rows: Record<string, string | number | boolean | null | undefined>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// CSV format detection
export type CSVFormat = "super_productivity" | "active_tasks" | "completed_tasks" | "todoist" | "focus_log" | "unknown";

export function detectCSVFormat(headers: string[]): CSVFormat {
  const h = new Set(headers.map((s) => s.trim().toLowerCase()));
  if (h.has("type") && h.has("content") && h.has("priority") && h.has("indent")) return "todoist";
  if (h.has("title") && h.has("project_title")) return "super_productivity";
  if (h.has("name") && h.has("do_date") && h.has("due_date")) return "active_tasks";
  if (h.has("name") && h.has("completed_at") && !h.has("due_date")) return "completed_tasks";
  if (h.has("planned_minutes") && h.has("actual_minutes") && h.has("start_time")) return "focus_log";
  return "unknown";
}

export function detectCSVFormatFromText(text: string): { format: CSVFormat; rows: Record<string, string>[] } {
  const delimiter = detectDelimiter(text);
  const rows = parseCSV(text, delimiter);
  if (rows.length === 0) return { format: "unknown", rows };
  const headers = Object.keys(rows[0]);
  return { format: detectCSVFormat(headers), rows };
}

export interface NativeImportedTask {
  name: string;
  priority: number;
  projectName: string;
  doDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completed: boolean;
  notes: string | null;
  createdAt: string | null;
}

export function mapNativeTaskCSV(rows: Record<string, string>[], completed: boolean): {
  tasks: NativeImportedTask[];
  projects: { name: string; color: string }[];
} {
  const projectSet = new Map<string, string>();
  let colorIdx = 0;

  const tasks: NativeImportedTask[] = rows
    .filter((r) => r.name?.trim())
    .map((r) => {
      const projectName = r.project?.trim() ?? "";
      if (projectName && !projectSet.has(projectName)) {
        projectSet.set(projectName, PROJECT_COLORS[colorIdx % PROJECT_COLORS.length]);
        colorIdx++;
      }
      return {
        name: r.name.trim(),
        priority: parseInt(r.priority ?? "0", 10) || 0,
        projectName,
        doDate: r.do_date?.trim() || null,
        dueDate: r.due_date?.trim() || null,
        completedAt: completed ? (r.completed_at?.trim() || null) : null,
        completed,
        notes: r.notes?.trim() || null,
        createdAt: r.created_at?.trim() || null,
      };
    });

  const projects = Array.from(projectSet.entries()).map(([name, color]) => ({ name, color }));
  return { tasks, projects };
}

export interface NativeImportedSession {
  date: string;
  plannedMinutes: number;
  actualMinutes: number | null;
  taskName: string;
  notes: string | null;
  startTime: string;
  endTime: string | null;
}

export function mapNativeFocusLogCSV(rows: Record<string, string>[]): NativeImportedSession[] {
  return rows
    .filter((r) => r.planned_minutes?.trim())
    .map((r) => ({
      date: r.date?.trim() ?? "",
      plannedMinutes: parseInt(r.planned_minutes?.trim() ?? "0", 10) || 0,
      actualMinutes: r.actual_minutes?.trim() ? parseInt(r.actual_minutes.trim(), 10) : null,
      taskName: r.task?.trim() ?? "",
      notes: r.notes?.trim() || null,
      startTime: r.start_time?.trim() ?? new Date().toISOString(),
      endTime: r.end_time?.trim() || null,
    }));
}

// Todoist CSV field mapping
// Todoist's own export/import format: semicolon-delimited, columns TYPE;
// CONTENT;DESCRIPTION;PRIORITY;INDENT;AUTHOR;RESPONSIBLE;DATE;DATE_LANG;
// TIMEZONE;DURATION;DURATION_UNIT;meta;DEADLINE;...
//
// TYPE is "task", "section", or "note" — only "task" rows become tasks here;
// "section" rows are skipped (Todoist sections don't map cleanly onto
// DB_Tasks' flat project model) and "note" rows are comments attached to the
// task in the row above, appended onto that task's notes rather than
// imported as their own task.
//
// PRIORITY is 1 (highest) to 4 (lowest/default) — inverted from DB_Tasks'
// 0-3 scale where 3 is highest — so the mapping is dbPriority = 4 - todoist.
// An empty PRIORITY cell means Todoist's own default of 1 (highest) per its
// documented format, so it maps to dbPriority 3, not 0.
//
// DATE is free text (Todoist accepts natural-language and recurring dates
// like "every year starting Jan 31"), not a clean ISO string. This does a
// best-effort Date.parse and falls back to null (no due date) rather than
// guessing, since a wrong date is worse than a missing one.
export function mapTodoistCSV(rows: Record<string, string>[]): {
  tasks: NativeImportedTask[];
  projects: { name: string; color: string }[];
  skippedSections: number;
  skippedNotes: number;
} {
  const tasks: NativeImportedTask[] = [];
  let skippedSections = 0;
  let skippedNotes = 0;

  for (const r of rows) {
    const type = (r.TYPE ?? r.type ?? "").trim().toLowerCase();

    if (type === "section") {
      skippedSections++;
      continue;
    }

    if (type === "note") {
      // Attach as a note-append to the most recently added task, if any —
      // Todoist orders "note" rows directly after the task they comment on.
      skippedNotes++;
      const content = (r.CONTENT ?? r.content ?? "").trim();
      const last = tasks[tasks.length - 1];
      if (last && content) {
        last.notes = last.notes ? `${last.notes}\n\n${content}` : content;
      }
      continue;
    }

    if (type !== "task") continue;

    const name = (r.CONTENT ?? r.content ?? "").trim();
    if (!name) continue;

    const priorityStr = (r.PRIORITY ?? r.priority ?? "").trim();
    const todoistPriority = priorityStr ? parseInt(priorityStr, 10) : 1;
    const dbPriority = Number.isFinite(todoistPriority)
      ? Math.min(3, Math.max(0, 4 - todoistPriority))
      : 0;

    const dateStr = (r.DATE ?? r.date ?? "").trim();
    const dueDate = parseTodoistDate(dateStr);

    const description = (r.DESCRIPTION ?? r.description ?? "").trim();

    tasks.push({
      name,
      priority: dbPriority,
      projectName: "",
      doDate: null,
      dueDate,
      completedAt: null,
      completed: false,
      notes: description || null,
      createdAt: null,
    });
  }

  return { tasks, projects: [], skippedSections, skippedNotes };
}

// Best-effort parse of Todoist's free-text DATE column into an ISO date.
// Returns null (no due date) rather than a guessed value for anything that
// doesn't parse cleanly — recurring-date phrasing ("every year...") and
// relative terms ("next week") aren't reconstructable from the export alone.
function parseTodoistDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (/^(every|each)\b/i.test(dateStr)) return null;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Super Productivity CSV field mapping
const PROJECT_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b",
  "#2980b9", "#8e44ad", "#27ae60", "#d35400", "#7f8c8d",
];

export interface ImportedTask {
  name: string;
  projectTitle: string;
  dueDate: string | null;
  doDate: string | null;
  completed: boolean;
  notes: string | null;
  estimateMinutes: number | null;
  priority: number;
}

export function mapSuperProductivityCSV(rows: Record<string, string>[]): {
  tasks: ImportedTask[];
  projects: { name: string; color: string }[];
} {
  const projectSet = new Map<string, string>();
  let colorIdx = 0;

  const tasks: ImportedTask[] = rows
    .filter((r) => r.title?.trim())
    .map((r) => {
      const projectTitle = r.project_title?.trim() ?? "";
      if (projectTitle && !projectSet.has(projectTitle)) {
        projectSet.set(projectTitle, PROJECT_COLORS[colorIdx % PROJECT_COLORS.length]);
        colorIdx++;
      }

      const msStr = r.time_estimate_ms?.trim();
      const estimateMinutes = msStr ? Math.round(parseInt(msStr, 10) / 60000) : null;

      // Parse priority: default 0, map if present
      let priority = 0;
      const pStr = r.priority?.trim();
      if (pStr === "URGENT") priority = 3;
      else if (pStr === "HIGH") priority = 2;
      else if (pStr === "LOW") priority = 1;

      return {
        name: r.title.trim(),
        projectTitle,
        dueDate: r.due_day?.trim() || null,
        doDate: r.planned_at?.trim() || null,
        completed: r.is_done?.trim() === "true" || r.is_done?.trim() === "1",
        notes: r.notes?.trim() || null,
        estimateMinutes: estimateMinutes && estimateMinutes > 0 ? estimateMinutes : null,
        priority,
      };
    });

  const projects = Array.from(projectSet.entries()).map(([name, color]) => ({ name, color }));
  return { tasks, projects };
}
