import { Link } from "@tanstack/react-router";
import * as React from "react";
import { SubtaskChecklistPreview } from "@/components/kanban/task-card-content";
import { useIdeaSubtasks, useUpdateIdeaSubtask } from "@/hooks/useIdeaSubtasks";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, addDays, startOfWeek } from "date-fns";
import {
  Check,
  MoreHorizontal,
  LayoutGrid,
  Inbox,
  Calendar,
  Pencil,
  Columns3,
  Trash2,
} from "lucide-react";
import type { Idea, IdeaColumn } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui";
import { HtmlContent } from "@/components/ui/html-content";
import { useDeleteIdea, usePromoteIdea, useUpdateIdea } from "@/hooks/useIdeas";
import { IdeaEditDialog } from "./idea-edit-dialog";

interface IdeaCardProps {
  idea: Idea;
  boardId: string;
  columns: IdeaColumn[];
  /** Rendered inside a DragOverlay — disables sortable wiring + menus. */
  overlay?: boolean;
  /** Reordering is meaningless while the board is filtered by a search. */
  dragDisabled?: boolean;
}

/** Menu family — lets one render path drive both the ⋯ dropdown and the
 * right-click context menu without duplicating the item list. */
interface MenuFamily {
  Item: React.ElementType;
  Separator: React.ElementType;
  Sub: React.ElementType;
  SubTrigger: React.ElementType;
  SubContent: React.ElementType;
}

const DROPDOWN_FAMILY: MenuFamily = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const CONTEXT_FAMILY: MenuFamily = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

interface IdeaMenuHandlers {
  onAddToToday: () => void;
  onSendToBacklog: () => void;
  onScheduleTomorrow: () => void;
  onScheduleNextWeek: () => void;
  onEdit: () => void;
  onMoveToColumn: (columnId: string) => void;
  onDelete: () => void;
}

/** The shared item list for both menu families. */
function IdeaMenuItems({
  family: C,
  handlers,
  otherColumns,
}: {
  family: MenuFamily;
  handlers: IdeaMenuHandlers;
  otherColumns: IdeaColumn[];
}) {
  return (
    <>
      <C.Item onSelect={handlers.onAddToToday}>
        <LayoutGrid className="mr-2 h-4 w-4" />
        Add to Today
      </C.Item>
      <C.Item onSelect={handlers.onSendToBacklog}>
        <Inbox className="mr-2 h-4 w-4" />
        Send to Backlog
      </C.Item>
      <C.Sub>
        <C.SubTrigger>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule
        </C.SubTrigger>
        <C.SubContent>
          <C.Item onSelect={handlers.onScheduleTomorrow}>Tomorrow</C.Item>
          <C.Item onSelect={handlers.onScheduleNextWeek}>Next week</C.Item>
        </C.SubContent>
      </C.Sub>

      <C.Separator />

      <C.Item onSelect={handlers.onEdit}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </C.Item>
      {otherColumns.length > 0 && (
        <C.Sub>
          <C.SubTrigger>
            <Columns3 className="mr-2 h-4 w-4" />
            Move to column
          </C.SubTrigger>
          <C.SubContent>
            {otherColumns.map((col) => (
              <C.Item
                key={col.id}
                onSelect={() => handlers.onMoveToColumn(col.id)}
              >
                {col.name}
              </C.Item>
            ))}
          </C.SubContent>
        </C.Sub>
      )}

      <C.Separator />

      <C.Item
        onSelect={handlers.onDelete}
        className="text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </C.Item>
    </>
  );
}

/**
 * An idea card. Visually the same component as the kanban task card
 * (task-card-content.tsx): circle checkbox + title + optional muted note,
 * a subtask counter, and both a ⋯ menu and a right-click context menu that
 * mirror the task actions, adapted for Ideas.
 */
export function IdeaCard({
  idea,
  boardId,
  columns,
  overlay,
  dragDisabled,
}: IdeaCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const updateIdea = useUpdateIdea(boardId);
  const deleteIdea = useDeleteIdea(boardId);
  const promoteIdea = usePromoteIdea(boardId);

  const sortable = useSortable({
    id: idea.id,
    data: { type: "idea", columnId: idea.columnId, idea },
    disabled: overlay || dragDisabled,
  });

  const isCompleted = !!idea.completedAt;
  const inPlanner = !!idea.promotedTaskId;
  const hasNotes =
    !!idea.notes && idea.notes.replace(/<[^>]*>/g, "").trim().length > 0;
  const subtaskTotal = idea.subtaskCount ?? 0;

  const style: React.CSSProperties = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      };

  // Show a crisp drop-indicator line only on the card currently being hovered
  // during a drag (matches the kanban task card) — not a persistent gap.
  const showIndicator = sortable.isOver && sortable.active?.id !== idea.id;
  let showDropAbove = false;
  let showDropBelow = false;
  if (showIndicator) {
    const activeColumn = sortable.active?.data?.current?.columnId as
      string | undefined;
    if (activeColumn !== idea.columnId) {
      // Cross-column drop inserts before the hovered card.
      showDropAbove = true;
    } else {
      const activeIndex =
        (sortable.active?.data?.current?.sortable?.index as
          number | undefined) ?? -1;
      showDropAbove = activeIndex > sortable.index;
      showDropBelow = activeIndex < sortable.index && activeIndex !== -1;
    }
  }

  const toggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateIdea.mutate({
      id: idea.id,
      input: { completedAt: isCompleted ? null : new Date() },
    });
  };

  const handleClick = () => {
    if (!sortable.isDragging) setEditOpen(true);
  };

  const otherColumns = columns.filter((c) => c.id !== idea.columnId);

  const handlers: IdeaMenuHandlers = {
    onAddToToday: () =>
      promoteIdea.mutate({
        id: idea.id,
        input: { scheduledDate: format(new Date(), "yyyy-MM-dd") },
      }),
    onSendToBacklog: () => promoteIdea.mutate({ id: idea.id }),
    onScheduleTomorrow: () =>
      promoteIdea.mutate({
        id: idea.id,
        input: { scheduledDate: format(addDays(new Date(), 1), "yyyy-MM-dd") },
      }),
    onScheduleNextWeek: () =>
      promoteIdea.mutate({
        id: idea.id,
        input: {
          scheduledDate: format(
            addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7),
            "yyyy-MM-dd"
          ),
        },
      }),
    onEdit: () => setEditOpen(true),
    onMoveToColumn: (columnId) =>
      updateIdea.mutate({ id: idea.id, input: { columnId } }),
    onDelete: () => deleteIdea.mutate(idea.id),
  };

  const cardInner = (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={overlay ? undefined : handleClick}
      className={cn(
        "group relative flex flex-col gap-1 rounded-lg px-3 py-2 transition-[background-color,box-shadow,opacity] duration-150",
        "bg-surface hover:bg-surface-hover",
        !overlay && !isCompleted && "shadow-card hover:shadow-card-hover",
        dragDisabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        "touch-auto select-none",
        overlay &&
          "shadow-xl ring-2 ring-primary/20 rotate-[0.5deg] cursor-grabbing",
        !overlay && sortable.isDragging && "opacity-30 z-50",
        isCompleted && "opacity-50 hover:opacity-60"
      )}
    >
      {/* Drop indicator lines (only on the hovered card during a drag) */}
      {showDropAbove && (
        <div className="absolute -top-1 left-0 right-0 z-10 h-0.5 rounded-full bg-primary" />
      )}
      {showDropBelow && (
        <div className="absolute -bottom-1 left-0 right-0 z-10 h-0.5 rounded-full bg-primary" />
      )}

      {/* Main row: checkbox + title */}
      <div className="flex items-start gap-2">
        <div
          role="checkbox"
          aria-checked={isCompleted}
          onClick={toggleComplete}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "relative mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-muted-foreground/40 hover:border-emerald-500"
          )}
        >
          {isCompleted && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </div>

        <p
          className={cn(
            "min-w-0 flex-1 text-sm leading-snug text-foreground wrap-break-word line-clamp-3",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {idea.title}
        </p>
      </div>

      {/* Optional notes preview (rich text) */}
      {/* Notes preview stays after completion — checking a card off changes
          the checkbox and strikes the title, nothing else. */}
      {hasNotes && (
        <HtmlContent
          html={idea.notes!}
          className="pl-6 text-xs leading-snug text-muted-foreground line-clamp-2 [&_p]:m-0 [&_img]:hidden"
        />
      )}

      {inPlanner && (
        <Link
          to="/app/focus/$taskId"
          params={{ taskId: idea.promotedTaskId! }}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
          Open task
        </Link>
      )}

      {/* Subtasks right on the card, tickable, as on task cards */}
      {subtaskTotal > 0 && <IdeaSubtaskPreview ideaId={idea.id} />}

      {/* ⋯ menu — appears on hover */}
      {!overlay && (
        <div
          className={cn(
            "absolute right-1.5 top-1.5 transition-opacity",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Idea actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 overflow-visible">
              <IdeaMenuItems
                family={DROPDOWN_FAMILY}
                handlers={handlers}
                otherColumns={otherColumns}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  if (overlay) return cardInner;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{cardInner}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <IdeaMenuItems
            family={CONTEXT_FAMILY}
            handlers={handlers}
            otherColumns={otherColumns}
          />
        </ContextMenuContent>
      </ContextMenu>

      {editOpen && (
        <IdeaEditDialog
          boardId={boardId}
          idea={idea}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}

function IdeaSubtaskPreview({ ideaId }: { ideaId: string }) {
  const { data: subtasks = [] } = useIdeaSubtasks(ideaId);
  const update = useUpdateIdeaSubtask();
  if (!subtasks.length) return null;
  return (
    <div className="pl-6" onPointerDown={(e) => e.stopPropagation()}>
      <SubtaskChecklistPreview
        subtasks={subtasks}
        onToggleSubtask={(id) => {
          const current = subtasks.find((s) => s.id === id);
          if (!current) return;
          update.mutate({
            ideaId,
            subtaskId: id,
            input: { completed: !current.completed },
          });
        }}
      />
    </div>
  );
}
