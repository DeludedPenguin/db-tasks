import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Plus, CalendarIcon } from "lucide-react";
import { useCreateTask, useSetTaskTags } from "@/hooks/useTasks";
import type { Project } from "@/hooks/useTasks";
import TagSelector from "@/components/tags/TagSelector";
import { toast } from "sonner";

export default function AddTaskForm({ projects }: { projects: Project[] }) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("0");
  const [projectId, setProjectId] = useState<string>("");
  const [doDate, setDoDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const createTask = useCreateTask();
  const setTaskTags = useSetTaskTags();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTask.mutate(
      {
        name: name.trim(),
        priority: parseInt(priority),
        project_id: projectId || null,
        do_date: doDate ? format(doDate, "yyyy-MM-dd") : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      },
      {
        onSuccess: (task) => {
          if (tagIds.length > 0) {
            setTaskTags.mutate({ taskId: task.id, tagIds });
          }
          setName("");
          setPriority("0");
          setProjectId("");
          setDoDate(undefined);
          setDueDate(undefined);
          setTagIds([]);
          toast.success("Task created");
        },
        onError: () => toast.error("Failed to create task"),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel flex flex-wrap items-end gap-2 rounded-xl p-3 sm:p-4">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="New task…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-panel/60"
        />
      </div>
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="w-[140px] bg-panel/60">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No project</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger className="w-[110px] bg-panel/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">None</SelectItem>
          <SelectItem value="1">Low</SelectItem>
          <SelectItem value="2">Medium</SelectItem>
          <SelectItem value="3">High</SelectItem>
        </SelectContent>
      </Select>
      <TagSelector selectedTagIds={tagIds} onChange={setTagIds} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <CalendarIcon className="h-3 w-3" />
            {doDate ? format(doDate, "MMM d") : "Do date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={doDate} onSelect={setDoDate} />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <CalendarIcon className="h-3 w-3" />
            {dueDate ? format(dueDate, "MMM d") : "Due date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
        </PopoverContent>
      </Popover>
      <Button type="submit" size="sm" disabled={!name.trim() || createTask.isPending}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </form>
  );
}
