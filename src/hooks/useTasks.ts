import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/data";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type Project = Tables<"projects">;
export type Tag = { id: string; user_id: string; name: string; color: string; created_at: string };
export type TaskTag = { id: string; task_id: string; tag_id: string };

export function useTasks(completed = false) {
  return useQuery({
    queryKey: ["tasks", { completed }],
    queryFn: () => db.listTasks(completed),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => db.listProjects() as Promise<Project[]>,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Omit<TablesInsert<"tasks">, "user_id">) => db.createTask(task),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: TablesUpdate<"tasks"> & { id: string }) =>
      db.updateTask(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => db.deleteTasks(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (project: { name: string; color: string }) => db.createProject(project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; color?: string }) =>
      db.updateProject(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useProjectTaskCounts() {
  return useQuery({
    queryKey: ["project-task-counts"],
    queryFn: async () => {
      const data = await db.listAllTasks();
      const counts: Record<string, { active: number; completed: number }> = {};
      for (const t of data) {
        const pid = t.project_id ?? "__none__";
        if (!counts[pid]) counts[pid] = { active: 0, completed: 0 };
        if (t.completed) counts[pid].completed++;
        else counts[pid].active++;
      }
      return counts;
    },
  });
}

// ---- Tags ----

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => db.listTags() as Promise<Tag[]>,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tag: { name: string; color: string }) => db.createTag(tag) as Promise<Tag>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; color?: string }) =>
      db.updateTag(id, updates) as Promise<Tag>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["task-tags"] });
    },
  });
}

export function useTaskTags(taskIds: string[]) {
  return useQuery({
    queryKey: ["task-tags", taskIds],
    enabled: taskIds.length > 0,
    queryFn: () => db.listTaskTags(taskIds) as Promise<(TaskTag & { tags: Tag })[]>,
  });
}

export function useSetTaskTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, tagIds }: { taskId: string; tagIds: string[] }) =>
      db.setTaskTags(taskId, tagIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-tags"] }),
  });
}
