import { format, isBefore, startOfDay } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import PriorityBadge from "./PriorityBadge";
import TagBadge from "@/components/tags/TagBadge";
import { cn } from "@/lib/utils";
import type { Tag } from "@/hooks/useTasks";

interface TaskRowProps {
  task: any;
  selected: boolean;
  tags?: Tag[];
  onSelect: (id: string, checked: boolean) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onEdit: (task: any) => void;
}

export default function TaskRow({ task, selected, tags = [], onSelect, onToggleComplete, onEdit }: TaskRowProps) {
  const project = task.projects as { name: string; color: string } | null;
  const isOverdue = !task.completed && task.due_date && isBefore(new Date(task.due_date), startOfDay(new Date()));

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-line bg-panel/55 px-3 py-2.5 backdrop-blur-xl transition duration-100 hover:border-aqua/40 sm:px-4 sm:py-3",
        selected && "border-aqua/50 bg-aqua/5 ring-1 ring-aqua/30"
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelect(task.id, !!v)}
        className="shrink-0"
      />
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggleComplete(task.id, !task.completed)}
        className="shrink-0 rounded-full"
      />
      <button
        className="flex flex-1 items-center gap-2 text-left min-w-0 flex-wrap"
        onClick={() => onEdit(task)}
      >
        <span className={cn("truncate text-[14px] font-semibold sm:text-[15px]", task.completed && "line-through text-muted-foreground")}> 
          {task.name}
        </span>
        {project && (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${project.color}22`,
              color: project.color,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project.color }} />
            {project.name}
          </span>
        )}
        <PriorityBadge priority={task.priority} />
        {tags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} />
        ))}
      </button>
      <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
        {isOverdue && (
          <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            overdue
          </span>
        )}
        {task.do_date && (
          <span title="Do date">📅 {format(new Date(task.do_date), "MMM d")}</span>
        )}
        {task.due_date && (
          <span title="Due date">⏰ {format(new Date(task.due_date), "MMM d")}</span>
        )}
      </div>
    </div>
  );
}
