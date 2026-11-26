import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical, Check } from "lucide-react";
import type { Subtask } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { useHoveredTask } from "@/hooks/useKeyboardShortcuts";
import {
  useSubtaskSize,
  useSubtaskStyles,
  subtaskCheckState,
} from "./subtask-size";
import { SubtaskTiming } from "./subtask-timing";

// Re-export for convenience
export type { Subtask };

interface SortableSubtaskItemProps {
  subtask: Subtask;
  isMobile: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate?: (title: string) => void;
}

/**
 * Sortable subtask row: gutter drag handle, round checkbox, click-to-edit
 * title and a delete button. Shared by the task modal and focus mode.
 */
export function SortableSubtaskItem({
  subtask,
  isMobile,
  onToggle,
  onDelete,
  onUpdate,
}: SortableSubtaskItemProps) {
  const { setHoveredSubtaskId } = useHoveredTask();
  const size = useSubtaskStyles();
  // The large rows (task modal, focus mode) carry times and a timer.
  const large = useSubtaskSize() === "lg";
  const showTiming = large && !subtask.id.startsWith("optimistic-");
  const compactTiming = showTiming && isMobile;
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(subtask.title);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const returnFocus = React.useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  React.useEffect(() => {
    setEditValue(subtask.title);
  }, [subtask.title]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== subtask.title && onUpdate) {
      onUpdate(trimmed);
    } else {
      setEditValue(subtask.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      returnFocus.current = true;
      handleSave();
    } else if (e.key === "Escape") {
      returnFocus.current = true;
      setEditValue(subtask.title);
      setIsEditing(false);
    }
  };

  const inlineHandle = large && isMobile;
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder subtask: ${subtask.title}`}
      data-escape-local={isDragging || undefined}
      className={cn(
        "absolute -left-4 top-1.5 hidden h-5 w-4 items-center justify-center rounded sm:flex",
        "cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity",
        "hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing",
        inlineHandle &&
          "sm:max-lg:static sm:max-lg:size-11 sm:max-lg:shrink-0 sm:max-lg:[@media(hover:none)]:opacity-100",
        isDragging && "opacity-100"
      )}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-subtask-id={subtask.id}
      className={cn(
        "group relative -mx-2 flex items-start rounded-md px-2 transition-colors",
        size.row,
        "hover:bg-muted/40",
        isEditing && "bg-muted/40",
        isDragging && "z-10 bg-muted/60 shadow-xs"
      )}
      onMouseEnter={() => setHoveredSubtaskId(subtask.id)}
      onMouseLeave={() => setHoveredSubtaskId(null)}
    >
      {!inlineHandle && handle}
      <button
        type="button"
        role="checkbox"
        aria-checked={subtask.completed}
        aria-label={subtask.title}
        onClick={onToggle}
        className={cn(
          "flex shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-all duration-150 active:scale-90",
          size.check,
          size.checkOffset,
          size.checkTarget,
          subtaskCheckState(subtask.completed)
        )}
      >
        <Check className={size.checkIcon} strokeWidth={3} />
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          data-escape-local="true"
          aria-label={`Edit subtask: ${subtask.title}`}
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent p-0 outline-hidden focus:ring-0",
            size.text,
            large && "max-lg:py-2.5"
          )}
        />
      ) : (
        <button
          type="button"
          aria-label={`Edit subtask: ${subtask.title}`}
          ref={(button) => {
            if (button && returnFocus.current) {
              returnFocus.current = false;
              button.focus();
            }
          }}
          disabled={!onUpdate}
          onClick={() => onUpdate && setIsEditing(true)}
          className={cn(
            "min-w-0 flex-1 break-words rounded-sm text-left transition-colors focus-visible:ring-1 focus-visible:ring-ring",
            large && "max-lg:py-2.5",
            size.text,
            onUpdate && "cursor-text",
            subtask.completed &&
              "text-muted-foreground line-through decoration-muted-foreground/50"
          )}
        >
          {subtask.title}
        </button>
      )}

      {inlineHandle && handle}

      {showTiming && (
        <SubtaskTiming
          subtask={subtask}
          onMobileDelete={compactTiming ? onDelete : undefined}
        />
      )}

      {!compactTiming && (
        <button
          type="button"
          aria-label={`Delete subtask: ${subtask.title}`}
          onClick={onDelete}
          className={cn(
            "-my-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/60",
            "opacity-0 transition-opacity hover:bg-muted hover:text-foreground",
            "group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
