import { useFocusSessions, useDeleteFocusSession } from "@/hooks/useFocusSessions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Timer, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function FocusLog() {
  const { data: sessions, isLoading } = useFocusSessions();
  const deleteSession = useDeleteFocusSession();

  const handleDelete = async (id: string) => {
    await deleteSession.mutateAsync(id);
    toast.success("Session deleted");
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Focus Log</h2>

      {!sessions?.length && (
        <p className="text-muted-foreground">No focus sessions recorded yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {sessions?.map((s) => {
          const taskName = (s as any).tasks?.name;
          return (
            <Card key={s.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Timer className="h-4 w-4 text-primary" />
                    {s.actual_minutes ?? s.planned_minutes} min
                    <span className="text-muted-foreground">/ {s.planned_minutes} planned</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(s.start_time), "MMM d, yyyy · h:mm a")}
                  </span>
                  {taskName && (
                    <span className="text-xs text-primary">
                      Linked to: {taskName}
                    </span>
                  )}
                  {s.notes && (
                    <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                      <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                      {s.notes}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
