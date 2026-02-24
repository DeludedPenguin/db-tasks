import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { parseCSV, mapSuperProductivityCSV, toCSV, downloadCSV, type ImportedTask } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useTasks, useProjects } from "@/hooks/useTasks";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ImportExport() {
  const [preview, setPreview] = useState<{ tasks: ImportedTask[]; projects: { name: string; color: string }[] } | null>(null);
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
      const rows = parseCSV(text);
      const result = mapSuperProductivityCSV(rows);
      setPreview(result);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Create projects (skip existing)
      const { data: existingProjects } = await supabase.from("projects").select("name").eq("user_id", user.id);
      const existingNames = new Set((existingProjects ?? []).map((p) => p.name));
      const newProjects = preview.projects.filter((p) => !existingNames.has(p.name));

      if (newProjects.length > 0) {
        await supabase.from("projects").insert(newProjects.map((p) => ({ ...p, user_id: user.id })));
      }

      // 2. Get all projects for mapping
      const { data: allProjects } = await supabase.from("projects").select("id, name").eq("user_id", user.id);
      const projectMap = new Map((allProjects ?? []).map((p) => [p.name, p.id]));

      // 3. Insert tasks
      const taskRows = preview.tasks.map((t) => ({
        user_id: user.id,
        name: t.name,
        project_id: t.projectTitle ? projectMap.get(t.projectTitle) ?? null : null,
        due_date: t.dueDate,
        do_date: t.doDate,
        completed: t.completed,
        completed_at: t.completed ? new Date().toISOString() : null,
        notes: t.notes,
        priority: t.priority,
      }));

      const { error } = await supabase.from("tasks").insert(taskRows);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project-task-counts"] });

      setImportDone(true);
      setPreview(null);
      toast.success(`Imported ${taskRows.length} tasks and ${newProjects.length} new projects`);
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Import & Export</h2>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Import from Super Productivity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV exported from Super Productivity. Projects will be auto-created and tasks mapped automatically.
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
              <h3 className="text-sm font-medium">Preview</h3>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{preview.tasks.length} tasks</span>
                <span>{preview.projects.length} projects</span>
                <span>{preview.tasks.filter((t) => t.completed).length} already completed</span>
              </div>

              <div className="max-h-60 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground">
                      <th className="p-2">Name</th>
                      <th className="p-2">Project</th>
                      <th className="p-2">Priority</th>
                      <th className="p-2">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.tasks.slice(0, 50).map((t, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 text-foreground">{t.name}</td>
                        <td className="p-2">{t.projectTitle}</td>
                        <td className="p-2">{t.priority}</td>
                        <td className="p-2">{t.completed ? "✓" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.tasks.length > 50 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Showing first 50 of {preview.tasks.length} tasks
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing…" : `Import ${preview.tasks.length} Tasks`}
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
