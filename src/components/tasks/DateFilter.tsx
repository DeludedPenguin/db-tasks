import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

export type DateFilterKey = "all" | "today" | "overdue" | "upcoming";

interface Props {
  value: DateFilterKey;
  onChange: (key: DateFilterKey) => void;
}

const options: { key: DateFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
];

export default function DateFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 text-xs">
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
