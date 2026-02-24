import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";
import { useTags } from "@/hooks/useTasks";

interface Props {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export default function TagFilter({ selectedTagIds, onChange }: Props) {
  const { data: tags = [] } = useTags();

  if (tags.length === 0) return null;

  const toggle = (tagId: string) => {
    onChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId]
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedTagIds.length > 0 ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs gap-1"
        >
          <Filter className="h-3 w-3" />
          {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""}` : "Filter tags"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50 cursor-pointer">
              <Checkbox
                checked={selectedTagIds.includes(tag.id)}
                onCheckedChange={() => toggle(tag.id)}
              />
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="truncate">{tag.name}</span>
            </label>
          ))}
        </div>
        {selectedTagIds.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full h-7 text-xs" onClick={() => onChange([])}>
            Clear filter
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
