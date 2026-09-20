import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

export type DateFilterKey = "all" | "today" | "do_or_due_today" | "overdue" | "upcoming" | "no_due" | "has_due";

interface Props {
  value: DateFilterKey;
  onChange: (key: DateFilterKey) => void;
}

const options: { key: DateFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "do_or_due_today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "has_due", label: "Has Due Date" },
  { key: "no_due", label: "No Due Date" },
];

export default function DateFilter({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <CalendarDays className="h-3 w-3 text-muted-foreground" />
      {options.map(({ key, label }) => (
        <Button
          key={key}
          variant={value === key ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
