import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { goalPath, useGoals } from "@/hooks/useGoals";

export function GoalPicker({
  value,
  onChange,
  onNavigate,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  onNavigate?: () => void;
  disabled?: boolean;
}) {
  const activeQuery = useGoals();
  const archivedQuery = useGoals(true);
  const active = activeQuery.data ?? [];
  const archived = archivedQuery.data ?? [];
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const all = [...active, ...archived];
  const selected = all.find((goal) => goal.id === value);
  const loading = activeQuery.isLoading || archivedQuery.isLoading;
  const error = activeQuery.isError || archivedQuery.isError;
  const matches = active.filter((goal) =>
    goalPath(goal, all).toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="rounded-md bg-muted px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
          >
            {selected
              ? goalPath(selected, all) +
                (selected.archivedAt ? " (archived)" : "")
              : value
                ? loading
                  ? "Loading linked goal…"
                  : "Linked goal unavailable"
                : loading
                  ? "Loading goals…"
                  : error
                    ? "Goals unavailable"
                    : "Add goal"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <input
            autoFocus
            aria-label="Search goals"
            placeholder="Search goals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="max-h-60 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Remove goal
              </button>
            )}
            {loading && (
              <p className="px-2 py-1.5 text-muted-foreground" role="status">
                Loading goals…
              </p>
            )}
            {error && (
              <p className="px-2 py-1.5 text-destructive" role="alert">
                Could not load goals.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    void activeQuery.refetch();
                    void archivedQuery.refetch();
                  }}
                >
                  Retry
                </button>
              </p>
            )}
            {!loading && !error && matches.length === 0 && (
              <p className="px-2 py-1.5 text-muted-foreground">
                No goals found.
              </p>
            )}
            {matches.map((goal) => (
              <button
                type="button"
                key={goal.id}
                disabled={disabled}
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  onChange(goal.id);
                  setOpen(false);
                }}
              >
                {goalPath(goal, all)}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <Link
          to="/app/goals"
          search={{
            goal: selected.id,
            archived: selected.archivedAt ? true : undefined,
          }}
          onClick={onNavigate}
          className="text-primary hover:underline"
        >
          Open goal
        </Link>
      )}
    </div>
  );
}
