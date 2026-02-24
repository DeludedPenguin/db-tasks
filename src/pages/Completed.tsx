import { useState } from "react";
import { useTasks, useProjects, useUpdateTask } from "@/hooks/useTasks";
import TaskRow from "@/components/tasks/TaskRow";
import EditTaskDialog from "@/components/tasks/EditTaskDialog";
import BulkActions from "@/components/tasks/BulkActions";
import type { Task } from "@/hooks/useTasks";

export default function Completed() {
  const { data: tasks = [], isLoading } = useTasks(true);
  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTask, setEditTask] = useState<Task | null>(null);

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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Completed Tasks</h2>

      <BulkActions
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        projects={projects}
        mode="completed"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No completed tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={selected.has(task.id)}
              onSelect={toggleSelect}
              onToggleComplete={toggleComplete}
              onEdit={setEditTask}
            />
          ))}
        </div>
      )}

      <EditTaskDialog task={editTask} projects={projects} onClose={() => setEditTask(null)} />
    </div>
  );
}
