import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useUpdateTask } from "@/hooks/useTasks";
import type { Task, Project } from "@/hooks/useTasks";
import { toast } from "sonner";

interface Props {
  task: Task | null;
  projects: Project[];
  onClose: () => void;
}

export default function EditTaskDialog({ task, projects, onClose }: Props) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("0");
  const [projectId, setProjectId] = useState("");
  const [doDate, setDoDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();
  const updateTask = useUpdateTask();

  useEffect(() => {
    if (task) {
      setName(task.name);
      setNotes(task.notes ?? "");
      setPriority(String(task.priority));
      setProjectId(task.project_id ?? "");
      setDoDate(task.do_date ? new Date(task.do_date) : undefined);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
    }
  }, [task]);

  const handleSave = () => {
    if (!task || !name.trim()) return;
    updateTask.mutate(
      {
        id: task.id,
        name: name.trim(),
        notes: notes || null,
        priority: parseInt(priority),
        project_id: projectId || null,
        do_date: doDate ? format(doDate, "yyyy-MM-dd") : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      },
      {
        onSuccess: () => { toast.success("Task updated"); onClose(); },
        onError: () => toast.error("Failed to update task"),
      }
    );
  };

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Do Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="mt-1 w-full justify-start gap-2 text-sm">
                    <CalendarIcon className="h-3 w-3" />
                    {doDate ? format(doDate, "MMM d, yyyy") : "Not set"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={doDate} onSelect={setDoDate} /></PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="mt-1 w-full justify-start gap-2 text-sm">
                    <CalendarIcon className="h-3 w-3" />
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Not set"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} /></PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || updateTask.isPending}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
