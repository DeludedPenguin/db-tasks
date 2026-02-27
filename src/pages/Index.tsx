import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useTasks, useProjects, useUpdateTask, useTaskTags } from "@/hooks/useTasks";
import AddTaskForm from "@/components/tasks/AddTaskForm";
import TaskRow from "@/components/tasks/TaskRow";
import EditTaskDialog from "@/components/tasks/EditTaskDialog";
import BulkActions from "@/components/tasks/BulkActions";
import SortControls, { type SortKey } from "@/components/tasks/SortControls";
import TagFilter from "@/components/tags/TagFilter";
import DateFilter, { type DateFilterKey } from "@/components/tasks/DateFilter";
import { format } from "date-fns";
import type { Task } from "@/hooks/useTasks";

export default function Index() {
  const { data: tasks = [], isLoading } = useTasks(false);
  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("all");

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

  // Filter by tags and date
  const filtered = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return tasks.filter((task) => {
      // Tag filter
      if (filterTagIds.length > 0) {
        const tags = taskTagsMap[task.id] ?? [];
        if (!filterTagIds.some((fid) => tags.some((t: any) => t.id === fid))) return false;
      }
      // Date filter
      if (dateFilter !== "all") {
        const due = task.due_date;
        const doDate = task.do_date;
        if (dateFilter === "today") return due === today;
        if (dateFilter === "do_or_due_today") return due === today || doDate === today;
        if (dateFilter === "overdue") return !!due && due <= today;
        if (dateFilter === "upcoming") return !!due && due > today;
        if (dateFilter === "no_due") return !due;
      }
      return true;
    });
  }, [tasks, filterTagIds, taskTagsMap, dateFilter]);

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

  const selectAll = () => {
    setSelected(new Set(sorted.map((t) => t.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="flex items-center gap-2">
          <DateFilter value={dateFilter} onChange={setDateFilter} />
          <TagFilter selectedTagIds={filterTagIds} onChange={setFilterTagIds} />
          <SortControls sortKey={sortKey} onSort={setSortKey} />
        </div>
      </div>

      <AddTaskForm projects={projects} />

      <div className="flex items-center gap-2">
        {sorted.length > 0 && selected.size < sorted.length && (
          <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
            Select all{sorted.length !== tasks.length ? ` (${sorted.length} filtered)` : ` (${sorted.length})`}
          </Button>
        )}
        <BulkActions
          selectedIds={Array.from(selected)}
          onClear={() => setSelected(new Set())}
          projects={projects}
          mode="active"
        />
      </div>

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
