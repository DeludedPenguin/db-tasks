import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, CheckCheck, RotateCcw } from "lucide-react";
import { useUpdateTask, useDeleteTasks } from "@/hooks/useTasks";
import type { Project } from "@/hooks/useTasks";
import { toast } from "sonner";

interface Props {
  selectedIds: string[];
  onClear: () => void;
  projects: Project[];
  mode: "active" | "completed";
}

export default function BulkActions({ selectedIds, onClear, projects, mode }: Props) {
  const updateTask = useUpdateTask();
  const deleteTasks = useDeleteTasks();
  const count = selectedIds.length;

  const bulkUpdate = (updates: Record<string, any>) => {
    Promise.all(
      selectedIds.map((id) => updateTask.mutateAsync({ id, ...updates }))
    ).then(() => { toast.success(`Updated ${count} tasks`); onClear(); });
  };

  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
      <span className="font-medium">{count} selected</span>
      {mode === "active" ? (
        <Button size="sm" variant="secondary" onClick={() => bulkUpdate({ completed: true, completed_at: new Date().toISOString() })}>
          <CheckCheck className="h-3 w-3 mr-1" /> Complete
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => bulkUpdate({ completed: false, completed_at: null })}>
          <RotateCcw className="h-3 w-3 mr-1" /> Restore
        </Button>
      )}
      <Select onValueChange={(v) => bulkUpdate({ priority: parseInt(v) })}>
        <SelectTrigger className="h-8 w-[100px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="0">None</SelectItem>
          <SelectItem value="1">Low</SelectItem>
          <SelectItem value="2">Medium</SelectItem>
          <SelectItem value="3">High</SelectItem>
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => bulkUpdate({ project_id: v === "none" ? null : v })}>
        <SelectTrigger className="h-8 w-[120px]"><SelectValue placeholder="Project" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No project</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="destructive" onClick={() => deleteTasks.mutate(selectedIds, { onSuccess: () => { toast.success(`Deleted ${count} tasks`); onClear(); } })}>
        <Trash2 className="h-3 w-3 mr-1" /> Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
    </div>
  );
}
