import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import {
  parseCSV,
  mapSuperProductivityCSV,
  toCSV,
  downloadCSV,
  detectCSVFormatFromText,
  mapNativeTaskCSV,
  mapNativeFocusLogCSV,
  type ImportedTask,
  type NativeImportedTask,
  type NativeImportedSession,
  type CSVFormat,
} from "@/lib/csv";
import { db, downloadJSON, type BackupFile } from "@/lib/data";
import { useTasks, useProjects } from "@/hooks/useTasks";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type PreviewData =
  | { type: "super_productivity"; tasks: ImportedTask[]; projects: { name: string; color: string }[] }
  | { type: "active_tasks" | "completed_tasks"; tasks: NativeImportedTask[]; projects: { name: string; color: string }[] }
  | { type: "focus_log"; sessions: NativeImportedSession[] };

const FORMAT_LABELS: Record<CSVFormat, string> = {
  super_productivity: "Super Productivity Export",
  active_tasks: "Active Tasks Export",
  completed_tasks: "Completed Tasks Export",
  focus_log: "Focus Log Export",
  unknown: "Unknown Format",
};

export default function ImportExport() {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: activeTasks = [] } = useTasks(false);
  const { data: completedTasks = [] } = useTasks(true);
  const { data: projects = [] } = useProjects();
  const { data: sessions = [] } = useFocusSessions();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { format, rows } = detectCSVFormatFromText(text);

      if (format === "super_productivity") {
        const result = mapSuperProductivityCSV(rows);
        setPreview({ type: "super_productivity", ...result });
      } else if (format === "active_tasks") {
        const result = mapNativeTaskCSV(rows, false);
        setPreview({ type: "active_tasks", ...result });
      } else if (format === "completed_tasks") {
        const result = mapNativeTaskCSV(rows, true);
        setPreview({ type: "completed_tasks", ...result });
      } else if (format === "focus_log") {
        const sessions = mapNativeFocusLogCSV(rows);
        setPreview({ type: "focus_log", sessions });
      } else {
        toast.error("Unrecognised CSV format. Please use a file exported from this app or Super Productivity.");
        setPreview(null);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const ensureProjects = async (projectNames: { name: string; color: string }[]) => {
    const existing = await db.listProjects();
    const existingNames = new Set(existing.map((p) => p.name));
    const newProjects = projectNames.filter((p) => p.name && !existingNames.has(p.name));
    if (newProjects.length > 0) await db.createProjects(newProjects);
    const all = await db.listProjects();
    return new Map(all.map((p) => [p.name as string, p.id as string]));
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project-task-counts"] });
    qc.invalidateQueries({ queryKey: ["focus-sessions"] });
    qc.invalidateQueries({ queryKey: ["tags"] });
    qc.invalidateQueries({ queryKey: ["task-tags"] });
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      if (preview.type === "super_productivity") {
        const projectMap = await ensureProjects(preview.projects);
        const taskRows = preview.tasks.map((t) => ({
          name: t.name,
          project_id: t.projectTitle ? projectMap.get(t.projectTitle) ?? null : null,
          due_date: t.dueDate,
          do_date: t.doDate,
          completed: t.completed,
          completed_at: t.completed ? new Date().toISOString() : null,
          notes: t.notes,
          priority: t.priority,
        }));
        await db.createTasks(taskRows);
        toast.success(`Imported ${taskRows.length} tasks`);
      } else if (preview.type === "active_tasks" || preview.type === "completed_tasks") {
        const projectMap = await ensureProjects(preview.projects);
        const taskRows = preview.tasks.map((t) => ({
          name: t.name,
          project_id: t.projectName ? projectMap.get(t.projectName) ?? null : null,
          due_date: t.dueDate,
          do_date: t.doDate,
          completed: t.completed,
          completed_at: t.completedAt,
          notes: t.notes,
          priority: t.priority,
        }));
        await db.createTasks(taskRows);
        toast.success(`Imported ${taskRows.length} ${preview.type === "active_tasks" ? "active" : "completed"} tasks`);
      } else if (preview.type === "focus_log") {
        // Try to match task names to existing tasks
        const allTasks = await db.listAllTasks();
        const taskNameMap = new Map(allTasks.map((t) => [t.name as string, t.id as string]));

        const sessionRows = preview.sessions.map((s) => ({
          date: s.date,
          planned_minutes: s.plannedMinutes,
          actual_minutes: s.actualMinutes,
          start_time: s.startTime,
          end_time: s.endTime,
          task_id: s.taskName ? taskNameMap.get(s.taskName) ?? null : null,
          notes: s.notes,
        }));
        await db.createFocusSessions(sessionRows);
        toast.success(`Imported ${sessionRows.length} focus sessions`);
      }

      refreshAll();
      setImportDone(true);
      setPreview(null);
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const exportBackup = async () => {
    try {
      const backup = await db.exportBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJSON(backup, `db-tasks-backup-${stamp}.json`);
      const d = backup.data;
      toast.success(
        `Backup saved — ${d.tasks.length} tasks, ${d.projects.length} projects, ${d.tags.length} tags, ${d.focus_sessions.length} sessions`,
      );
    } catch (err: any) {
      toast.error("Backup failed: " + err.message);
    }
  };

  const handleBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupFile;
        if (parsed?.format !== "db_tasks_backup") throw new Error("Not a DB_Tasks backup file");
        setBackup(parsed);
      } catch (err: any) {
        toast.error("Could not read backup: " + err.message);
        setBackup(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const restoreBackup = async (mode: "merge" | "replace") => {
    if (!backup) return;
    if (mode === "replace" && !confirm("Replace everything currently in the app with this backup? This cannot be undone.")) return;
    setRestoring(true);
    try {
      await db.importBackup(backup, mode);
      refreshAll();
      setBackup(null);
      toast.success(mode === "replace" ? "Backup restored (everything replaced)" : "Backup merged in");
    } catch (err: any) {
      toast.error("Restore failed: " + err.message);
    } finally {
      setRestoring(false);
    }
  };

  const exportActiveTasks = () => {
    const rows = activeTasks.map((t: any) => ({
      name: t.name,
      priority: t.priority,
      project: t.projects?.name ?? "",
      do_date: t.do_date ?? "",
      due_date: t.due_date ?? "",
      notes: t.notes ?? "",
      created_at: t.created_at,
    }));
    downloadCSV(toCSV(rows), "active-tasks.csv");
    toast.success("Active tasks exported");
  };

  const exportCompletedTasks = () => {
    const rows = completedTasks.map((t: any) => ({
      name: t.name,
      priority: t.priority,
      project: t.projects?.name ?? "",
      completed_at: t.completed_at ?? "",
      notes: t.notes ?? "",
      created_at: t.created_at,
    }));
    downloadCSV(toCSV(rows), "completed-tasks.csv");
    toast.success("Completed tasks exported");
  };

  const exportFocusLog = () => {
    const rows = sessions.map((s: any) => ({
      date: s.date,
      planned_minutes: s.planned_minutes,
      actual_minutes: s.actual_minutes ?? "",
      task: s.tasks?.name ?? "",
      notes: s.notes ?? "",
      start_time: s.start_time,
      end_time: s.end_time ?? "",
    }));
    downloadCSV(toCSV(rows), "focus-log.csv");
    toast.success("Focus log exported");
  };

  const formatLabel = preview ? FORMAT_LABELS[preview.type] : "";
  const previewCount =
    preview?.type === "focus_log" ? preview.sessions.length :
    preview ? preview.tasks.length : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Import & Export</h2>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-mono text-sm text-muted-foreground">
            Upload a CSV exported from this app or from Super Productivity. The format is auto-detected.
          </p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" />
            Select CSV File
          </Button>

          {importDone && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" /> Import completed successfully!
            </div>
          )}

          {preview && (
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Preview</h3>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  Detected: {formatLabel}
                </span>
              </div>

              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{previewCount} {preview.type === "focus_log" ? "sessions" : "tasks"}</span>
                {preview.type !== "focus_log" && (
                  <span>{preview.projects.length} projects</span>
                )}
                {preview.type === "super_productivity" && (
                  <span>{preview.tasks.filter((t) => t.completed).length} already completed</span>
                )}
              </div>

              <div className="max-h-60 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground">
                      {preview.type === "focus_log" ? (
                        <>
                          <th className="p-2">Date</th>
                          <th className="p-2">Planned</th>
                          <th className="p-2">Actual</th>
                          <th className="p-2">Task</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2">Name</th>
                          <th className="p-2">Project</th>
                          <th className="p-2">Priority</th>
                          <th className="p-2">{preview.type === "completed_tasks" ? "Completed" : "Done"}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.type === "focus_log"
                      ? preview.sessions.slice(0, 50).map((s, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="p-2 text-foreground">{s.date}</td>
                            <td className="p-2">{s.plannedMinutes}m</td>
                            <td className="p-2">{s.actualMinutes ?? "—"}m</td>
                            <td className="p-2">{s.taskName || "—"}</td>
                          </tr>
                        ))
                      : (preview.type === "super_productivity"
                          ? preview.tasks.slice(0, 50).map((t, i) => (
                              <tr key={i} className="border-t border-border">
                                <td className="p-2 text-foreground">{t.name}</td>
                                <td className="p-2">{t.projectTitle}</td>
                                <td className="p-2">{t.priority}</td>
                                <td className="p-2">{t.completed ? "✓" : ""}</td>
                              </tr>
                            ))
                          : preview.tasks.slice(0, 50).map((t, i) => (
                              <tr key={i} className="border-t border-border">
                                <td className="p-2 text-foreground">{t.name}</td>
                                <td className="p-2">{t.projectName}</td>
                                <td className="p-2">{t.priority}</td>
                                <td className="p-2">{t.completed ? "✓" : ""}</td>
                              </tr>
                            ))
                        )}
                  </tbody>
                </table>
              </div>

              {previewCount > 50 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Showing first 50 of {previewCount} {preview.type === "focus_log" ? "sessions" : "tasks"}
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing…" : `Import ${previewCount} ${preview.type === "focus_log" ? "Sessions" : "Tasks"}`}
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportActiveTasks}>
            Active Tasks ({activeTasks.length})
          </Button>
          <Button variant="outline" onClick={exportCompletedTasks}>
            Completed Tasks ({completedTasks.length})
          </Button>
          <Button variant="outline" onClick={exportFocusLog}>
            Focus Log ({sessions.length})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
