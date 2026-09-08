import { useState } from "react";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, useProjectTaskCounts } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Project } from "@/hooks/useTasks";

const PRESET_COLORS = [
  "#3498db", "#2ecc71", "#e74c3c", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b",
  "#2980b9", "#8e44ad", "#27ae60", "#d35400", "#7f8c8d",
];

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const { data: counts } = useProjectTaskCounts();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setDialogOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setName(p.name);
    setColor(p.color);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    try {
      if (editing) {
        await updateProject.mutateAsync({ id: editing.id, name: name.trim(), color });
        toast.success("Project updated");
      } else {
        await createProject.mutateAsync({ name: name.trim(), color });
        toast.success("Project created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save project");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProject.mutateAsync(deleteTarget.id);
      toast.success("Project deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete project");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-2xl font-semibold tracking-tight text-foreground">Projects</h2>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !projects?.length ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 font-mono sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const c = counts?.[p.id];
            return (
              <div
                key={p.id}
                className="group relative flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30 cursor-pointer"
                onClick={() => navigate(`/?project=${p.id}`)}
              >
                <div
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: p.color }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground truncate">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {c ? `${c.active} active · ${c.completed} done` : "0 tasks"}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tasks in this project will become unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
