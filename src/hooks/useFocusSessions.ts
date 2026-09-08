import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/data";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type FocusSession = Tables<"focus_sessions">;

export function useFocusSessions() {
  return useQuery({
    queryKey: ["focus-sessions"],
    queryFn: () => db.listFocusSessions(),
  });
}

export function useCreateFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (session: Omit<TablesInsert<"focus_sessions">, "user_id">) =>
      db.createFocusSession(session),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["focus-sessions"] }),
  });
}

export function useUpdateFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: TablesUpdate<"focus_sessions"> & { id: string }) =>
      db.updateFocusSession(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["focus-sessions"] }),
  });
}

export function useDeleteFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.deleteFocusSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["focus-sessions"] }),
  });
}
