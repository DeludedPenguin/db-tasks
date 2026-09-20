import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

export type SortKey = "priority" | "project" | "do_date" | "due_date" | "created_at";

interface Props {
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
}

const options: { key: SortKey; label: string }[] = [
  { key: "priority", label: "Priority" },
  { key: "project", label: "Project" },
  { key: "do_date", label: "Do Date" },
  { key: "due_date", label: "Due Date" },
  { key: "created_at", label: "Created" },
];

export default function SortControls({ sortKey, onSort }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      {options.map(({ key, label }) => (
        <Button
          key={key}
          variant={sortKey === key ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onSort(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
