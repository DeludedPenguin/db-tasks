// CSV parsing and generation utilities

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] ?? "").trim()));
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
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
