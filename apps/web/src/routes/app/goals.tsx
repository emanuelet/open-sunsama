import * as React from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Goal, Task } from "@open-sunsama/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { TaskModal } from "@/components/kanban/task-modal";
import { useInfiniteSearchTasks } from "@/hooks/useInfiniteSearchTasks";
import {
  goalPath,
  useGoalActions,
  useGoalTasks,
  useGoals,
} from "@/hooks/useGoals";
import { useUpdateTask } from "@/hooks/useTasks";
import { useQueryClient } from "@tanstack/react-query";
import { goalKeys } from "@/lib/query-keys";
import { GoalHierarchy } from "@/components/goals/goal-hierarchy";

const field =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function QuickAdd({ parentId }: { parentId: string | null }) {
  const [title, setTitle] = React.useState("");
  const { create } = useGoalActions();
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim())
          create.mutate(
            { title: title.trim(), parentId },
            { onSuccess: () => setTitle("") }
          );
      }}
    >
      <input
        className={field}
        aria-label={parentId ? "New supporting goal" : "New goal"}
        placeholder={parentId ? "Add a supporting goal…" : "Add a goal…"}
        maxLength={500}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        disabled={!title.trim() || create.isPending}
      >
        <Plus className="h-4 w-4" /> Add
      </Button>
    </form>
  );
}

function EditableText({
  value,
  label,
  placeholder,
  multiline,
  readOnly,
  title,
  onSave,
}: {
  value: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  readOnly?: boolean;
  title?: boolean;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = React.useState(value);
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">(
    "idle"
  );
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => setDraft(value), [value]);
  React.useLayoutEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [draft, title]);
  const save = async () => {
    if (title && !draft.trim()) {
      setDraft(value);
      setStatus("idle");
      return;
    }
    if (draft.trim() === value) return;
    setStatus("saving");
    try {
      await onSave(draft.trim());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };
  const props = {
    "aria-label": label,
    placeholder,
    readOnly,
    maxLength: title ? 500 : 5000,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => {
      void save();
    },
  };
  return (
    <div className={title ? "min-w-0 flex-1" : undefined}>
      {title ? (
        <textarea
          {...props}
          ref={titleRef}
          rows={1}
          className="block w-full resize-none overflow-hidden rounded-md bg-transparent text-[20px] leading-[27.5px] font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl sm:leading-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      ) : multiline ? (
        <textarea {...props} rows={3} className={field + " resize-y"} />
      ) : (
        <input {...props} className={field} />
      )}
      {status === "saving" && (
        <p className="text-xs text-muted-foreground" role="status">
          Saving…
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive" role="alert">
          Could not save.{" "}
          <button
            type="button"
            className="underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void save()}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
}

function GoalCards({
  goals,
  parentId,
  archived,
}: {
  goals: Goal[];
  parentId: string | null;
  archived: boolean;
}) {
  const actions = useGoalActions();
  const ordered = [...goals].sort((a, b) => a.position - b.position);
  const move = (index: number, delta: number) => {
    const ids = ordered.map((g) => g.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    actions.reorder.mutate({ parentId, goalIds: ids });
  };
  return (
    <div className="space-y-2">
      {ordered.map((goal, index) => (
        <div
          key={goal.id}
          className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-card"
        >
          <Link
            to="/app/goals"
            search={{ goal: goal.id, archived: archived || undefined }}
            className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="break-words text-sm leading-5">{goal.title}</div>
            {goal.description && (
              <p className="mt-1 line-clamp-3 text-[13px] text-muted-foreground">
                {goal.description}
              </p>
            )}
          </Link>
          {!archived && (
            <div className="flex items-center">
              <button
                type="button"
                aria-label={`Move ${goal.title} up`}
                disabled={index === 0 || actions.reorder.isPending}
                onClick={() => move(index, -1)}
                className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Move ${goal.title} down`}
                disabled={
                  index === ordered.length - 1 || actions.reorder.isPending
                }
                onClick={() => move(index, 1)}
                className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

function LinkTasks({
  goalId,
  open,
  onOpenChange,
}: {
  goalId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [search, setSearch] = React.useState("");
  const results = useInfiniteSearchTasks({ query: search, status: "all" });
  const update = useUpdateTask();
  const qc = useQueryClient();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Link an existing task</DialogTitle>
        <input
          autoFocus
          aria-label="Search tasks"
          placeholder="Search all tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={field}
        />
        <div className="max-h-80 overflow-y-auto space-y-1">
          {results.data?.pages
            .flatMap((page) => page.data)
            .map((task) => (
              <button
                key={task.id}
                type="button"
                disabled={update.isPending || task.goalId === goalId}
                className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                onClick={() =>
                  update.mutate(
                    { id: task.id, data: { goalId } },
                    {
                      onSuccess: () => {
                        void qc.invalidateQueries({
                          queryKey: goalKeys.tasks(),
                        });
                        onOpenChange(false);
                      },
                    }
                  )
                }
              >
                {task.title}
                {task.goalId === goalId
                  ? " (linked)"
                  : task.goalId
                    ? " (linked to another goal)"
                    : ""}
              </button>
            ))}
          {results.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={results.isFetchingNextPage}
              onClick={() => void results.fetchNextPage()}
            >
              Load more
            </Button>
          )}
          {results.isError && (
            <div role="alert" className="p-2 text-sm text-destructive">
              Could not load tasks.{" "}
              <button
                className="underline"
                onClick={() => void results.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {!results.isLoading &&
            !results.isError &&
            !results.data?.pages.some((p) => p.data.length) && (
              <p className="p-2 text-sm text-muted-foreground">
                No tasks found.
              </p>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GoalsPage() {
  const {
    goal: goalId,
    archived = false,
    view,
  } = useSearch({ from: "/app/goals" });
  const navigate = useNavigate();
  const activeQuery = useGoals();
  const archiveQuery = useGoals(true);
  const active = activeQuery.data ?? [];
  const archivedGoals = archiveQuery.data ?? [];
  const all = [...active, ...archivedGoals];
  const goal = all.find((g) => g.id === goalId);
  const actions = useGoalActions();
  const taskQuery = useGoalTasks(goal?.id);
  const tasks = taskQuery.data ?? [];
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [compose, setCompose] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [moveSearch, setMoveSearch] = React.useState("");
  const isArchived = !!goal?.archivedAt;
  const viewingArchived = goal ? isArchived : archived;
  const siblings = (viewingArchived ? archivedGoals : active).filter((g) =>
    goal
      ? g.parentId === goal.id
      : !g.parentId ||
        (viewingArchived && !archivedGoals.some((p) => p.id === g.parentId))
  );
  const ancestors: Goal[] = [];
  let cursor = goal?.parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = all.find((g) => g.id === cursor);
    if (!parent) break;
    ancestors.unshift(parent);
    cursor = parent.parentId;
  }
  const isDescendant = (candidate: Goal) => {
    let parent = candidate.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      if (parent === goal?.id) return true;
      visited.add(parent);
      parent = all.find((g) => g.id === parent)?.parentId ?? null;
    }
    return false;
  };
  const goRoot = () =>
    void navigate({
      to: "/app/goals",
      search: { archived: archived || undefined, view },
    });
  return (
    <div className="h-full overflow-y-auto bg-canvas px-4 py-5 sm:px-6">
      <div
        className={`mx-auto space-y-5 pb-20 ${!goalId && view ? "max-w-6xl" : "max-w-2xl"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground"
          >
            <Link
              to="/app/goals"
              search={{ archived: viewingArchived || undefined, view }}
              className="hover:text-foreground"
            >
              {viewingArchived ? "Archived goals" : "Goals"}
            </Link>
            {ancestors.map((parent) => (
              <React.Fragment key={parent.id}>
                <ChevronRight className="h-3 w-3" />
                <Link
                  to="/app/goals"
                  search={{
                    goal: parent.id,
                    archived: parent.archivedAt ? true : undefined,
                  }}
                  className="hover:text-foreground"
                >
                  {parent.title}
                </Link>
              </React.Fragment>
            ))}
            {goal && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">{goal.title}</span>
              </>
            )}
          </nav>
          {!goal && (
            <Link
              to="/app/goals"
              search={{ archived: archived ? undefined : true, view }}
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              {archived ? "Active goals" : "Archived goals"}
            </Link>
          )}
        </div>
        {activeQuery.isError || archiveQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load goals. Please try again.
          </p>
        ) : activeQuery.isLoading || archiveQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading goals…</p>
        ) : goalId && !goal ? (
          <p className="text-sm text-muted-foreground">Goal not found.</p>
        ) : goal ? (
          <>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <EditableText
                  readOnly={isArchived}
                  title
                  key={`${goal.id}-title`}
                  value={goal.title}
                  label="Goal title"
                  placeholder="Goal title"
                  onSave={(title) =>
                    actions.update.mutateAsync({ id: goal.id, data: { title } })
                  }
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Goal actions"
                      disabled={
                        actions.update.isPending ||
                        actions.archive.isPending ||
                        actions.restore.isPending
                      }
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isArchived ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          actions.restore.mutate(goal.id, {
                            onSuccess: () => goRoot(),
                          })
                        }
                      >
                        Restore goal
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
                          Archive
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <EditableText
                readOnly={isArchived}
                key={`${goal.id}-description`}
                value={goal.description ?? ""}
                label="Goal description"
                placeholder="Add a description (optional)…"
                multiline
                onSave={(description) =>
                  actions.update.mutateAsync({
                    id: goal.id,
                    data: { description: description || null },
                  })
                }
              />
            </div>
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold">Supporting goals</h2>
              {!isArchived && <QuickAdd parentId={goal.id} />}
              <GoalCards
                goals={siblings}
                parentId={goal.id}
                archived={isArchived}
              />
              {siblings.length === 0 && (
                <p className="text-[13px] text-muted-foreground">
                  No supporting goals yet.
                </p>
              )}
            </section>
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold">Connected tasks</h2>
              {!isArchived && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCompose(true)}
                  >
                    Add task
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLinkOpen(true)}
                  >
                    Link existing task
                  </Button>
                </div>
              )}
              {taskQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not load connected tasks.{" "}
                  <button
                    className="underline"
                    onClick={() => void taskQuery.refetch()}
                  >
                    Retry
                  </button>
                </p>
              ) : taskQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading tasks…</p>
              ) : tasks.length ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="block w-full rounded-lg bg-card px-3 py-2 text-left text-sm shadow-card hover:bg-accent"
                    >
                      {task.title}
                      {task.completedAt && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Completed
                        </span>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {task.scheduledDate
                          ? `Scheduled ${format(parseISO(task.scheduledDate), "MMM d, yyyy")}`
                          : "Unscheduled"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  No connected tasks yet.
                </p>
              )}
            </section>
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold">
                Current reflection{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </h2>
              <EditableText
                readOnly={isArchived}
                key={`${goal.id}-reflection`}
                value={goal.reflection ?? ""}
                label="Current reflection"
                placeholder="A thought to return to…"
                multiline
                onSave={(reflection) =>
                  actions.update.mutateAsync({
                    id: goal.id,
                    data: { reflection: reflection || null },
                  })
                }
              />
            </section>
            <LinkTasks
              goalId={goal.id}
              open={linkOpen}
              onOpenChange={setLinkOpen}
            />
            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
              <DialogContent>
                <DialogTitle>Move goal</DialogTitle>
                <input
                  className={field}
                  placeholder="Search goals…"
                  aria-label="Search destination goals"
                  value={moveSearch}
                  onChange={(e) => setMoveSearch(e.target.value)}
                />
                <div className="max-h-72 overflow-y-auto">
                  <button
                    disabled={actions.update.isPending}
                    className="w-full rounded p-2 text-left text-sm hover:bg-accent"
                    onClick={() =>
                      actions.update.mutate(
                        { id: goal.id, data: { parentId: null } },
                        { onSuccess: () => setMoveOpen(false) }
                      )
                    }
                  >
                    Top level
                  </button>
                  {active
                    .filter(
                      (g) =>
                        g.id !== goal.id &&
                        !isDescendant(g) &&
                        goalPath(g, all)
                          .toLowerCase()
                          .includes(moveSearch.toLowerCase())
                    )
                    .map((g) => (
                      <button
                        key={g.id}
                        disabled={actions.update.isPending}
                        className="w-full rounded p-2 text-left text-sm hover:bg-accent"
                        onClick={() =>
                          actions.update.mutate(
                            { id: goal.id, data: { parentId: g.id } },
                            { onSuccess: () => setMoveOpen(false) }
                          )
                        }
                      >
                        {goalPath(g, all)}
                      </button>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent>
                <DialogTitle>Archive this goal?</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  This also archives its supporting goals. Connected tasks and
                  their links are kept.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={actions.archive.isPending}
                    onClick={() => setConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={actions.archive.isPending}
                    onClick={() =>
                      actions.archive.mutate(goal.id, {
                        onSuccess: () => {
                          setConfirmOpen(false);
                          goRoot();
                        },
                      })
                    }
                  >
                    Archive goal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <TaskModal
              task={selectedTask}
              open={!!selectedTask || compose}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedTask(null);
                  setCompose(false);
                }
              }}
              createDefaults={compose ? { goalId: goal.id } : undefined}
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-semibold">
                {archived ? "Archived goals" : "Goals"}
              </h1>
              <div
                className="inline-flex w-fit rounded-md bg-muted p-0.5"
                aria-label="Goals view"
              >
                <button
                  type="button"
                  aria-pressed={!view}
                  onClick={() =>
                    void navigate({
                      to: "/app/goals",
                      search: { archived: archived || undefined },
                    })
                  }
                  className={`rounded px-3 py-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!view ? "bg-card shadow-card" : "text-muted-foreground"}`}
                >
                  List
                </button>
                <button
                  type="button"
                  aria-pressed={!!view}
                  onClick={() =>
                    void navigate({
                      to: "/app/goals",
                      search: {
                        archived: archived || undefined,
                        view: "hierarchy",
                      },
                    })
                  }
                  className={`rounded px-3 py-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view ? "bg-card shadow-card" : "text-muted-foreground"}`}
                >
                  Hierarchy
                </button>
              </div>
            </div>
            {!archived && !view && <QuickAdd parentId={null} />}
            {view ? (
              <GoalHierarchy
                goals={archived ? archivedGoals : active}
                archived={archived}
              />
            ) : (
              <GoalCards goals={siblings} parentId={null} archived={archived} />
            )}
            {siblings.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {archived
                  ? "No archived goals."
                  : "Add an intention you want to return to."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
