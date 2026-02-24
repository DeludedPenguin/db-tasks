import { cn } from "@/lib/utils";

const labels = ["None", "Low", "Medium", "High"] as const;
const colors = [
  "bg-priority-none/20 text-priority-none",
  "bg-priority-low/20 text-priority-low",
  "bg-priority-medium/20 text-priority-medium",
  "bg-priority-high/20 text-priority-high",
];

export default function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[priority] ?? colors[0]
      )}
    >
      {labels[priority] ?? "None"}
    </span>
  );
}
