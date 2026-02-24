import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tags, Plus } from "lucide-react";
import { useTags, useCreateTag, type Tag } from "@/hooks/useTasks";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6",
];

interface Props {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export default function TagSelector({ selectedTagIds, onChange }: Props) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [showNew, setShowNew] = useState(false);

  const toggle = (tagId: string) => {
    onChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId]
    );
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTag.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: (tag) => {
          onChange([...selectedTagIds, tag.id]);
          setNewName("");
          setShowNew(false);
        },
      }
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <Tags className="h-3 w-3" />
          {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""}` : "Tags"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
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
          {tags.length === 0 && !showNew && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No tags yet</p>
          )}
        </div>
        {showNew ? (
          <div className="mt-2 space-y-2 border-t border-border pt-2">
            <Input
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-5 w-5 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? "hsl(var(--foreground))" : "transparent",
                    transform: newColor === c ? "scale(1.2)" : "scale(1)",
                  }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newName.trim()}>
                Create
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full h-7 text-xs gap-1"
            onClick={() => setShowNew(true)}
          >
            <Plus className="h-3 w-3" /> New tag
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
