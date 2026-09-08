import type { Tag } from "@/hooks/useTasks";

export default function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium"
      style={{
        backgroundColor: `${tag.color}22`,
        color: tag.color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}
