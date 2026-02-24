import { useState, useMemo } from "react";
import { useTasks, useProjects, useUpdateTask, useTaskTags } from "@/hooks/useTasks";
import AddTaskForm from "@/components/tasks/AddTaskForm";
import TaskRow from "@/components/tasks/TaskRow";
import EditTaskDialog from "@/components/tasks/EditTaskDialog";
import BulkActions from "@/components/tasks/BulkActions";
import SortControls, { type SortKey } from "@/components/tasks/SortControls";
import TagFilter from "@/components/tags/TagFilter";
import type { Task } from "@/hooks/useTasks";

export default function Index() {
  const { data: tasks = [], isLoading } = useTasks(false);
  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const { data: taskTagsData = [] } = useTaskTags(taskIds);

  // Build a map: taskId -> Tag[]
  const taskTagsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const tt of taskTagsData) {
      if (!map[tt.task_id]) map[tt.task_id] = [];
      map[tt.task_id].push(tt.tags);
    }
    return map;
  }, [taskTagsData]);

  // Filter by tags
  const filtered = useMemo(() => {
    if (filterTagIds.length === 0) return tasks;
    return tasks.filter((task) => {
      const tags = taskTagsMap[task.id] ?? [];
      return filterTagIds.some((fid) => tags.some((t: any) => t.id === fid));
    });
  }, [tasks, filterTagIds, taskTagsMap]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      switch (sortKey) {
        case "priority": return b.priority - a.priority;
        case "project": {
          const pa = (a as any).projects?.name ?? "";
          const pb = (b as any).projects?.name ?? "";
          return pa.localeCompare(pb);
        }
        case "do_date": return (a.do_date ?? "z").localeCompare(b.do_date ?? "z");
        case "due_date": return (a.due_date ?? "z").localeCompare(b.due_date ?? "z");
        case "created_at": return b.created_at.localeCompare(a.created_at);
        default: return 0;
      }
    });
    return list;
  }, [filtered, sortKey]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const toggleComplete = (id: string, completed: boolean) => {
    updateTask.mutate({
      id,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    });
  };

  // Get tag IDs for the task being edited
  const editTaskTagIds = useMemo(() => {
    if (!editTask) return [];
    return (taskTagsMap[editTask.id] ?? []).map((t: any) => t.id);
  }, [editTask, taskTagsMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="flex items-center gap-2">
          <TagFilter selectedTagIds={filterTagIds} onChange={setFilterTagIds} />
          <SortControls sortKey={sortKey} onSort={setSortKey} />
        </div>
      </div>

      <AddTaskForm projects={projects} />

      <BulkActions
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        projects={projects}
        mode="active"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No active tasks. Add one above!</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={selected.has(task.id)}
              tags={taskTagsMap[task.id] ?? []}
              onSelect={toggleSelect}
              onToggleComplete={toggleComplete}
              onEdit={setEditTask}
            />
          ))}
        </div>
      )}

      <EditTaskDialog
        task={editTask}
        projects={projects}
        initialTagIds={editTaskTagIds}
        onClose={() => setEditTask(null)}
      />
    </div>
  );
}
