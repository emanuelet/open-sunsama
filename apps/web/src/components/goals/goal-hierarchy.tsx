import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FoldVertical,
  GitBranch,
  Target,
  UnfoldVertical,
} from "lucide-react";
import type { Goal } from "@open-sunsama/types";

type Connection = { id: string; path: string; x: number; y: number };

export function GoalHierarchy({
  goals,
  archived,
}: {
  goals: Goal[];
  archived: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [connections, setConnections] = React.useState<Connection[]>([]);
  const graph = React.useRef<HTMLDivElement>(null);
  const cards = React.useRef(new Map<string, HTMLDivElement>());
  const { roots, children } = React.useMemo(() => {
    const ids = new Set(goals.map((goal) => goal.id));
    const children = new Map<string, Goal[]>();
    const roots: Goal[] = [];
    for (const goal of goals) {
      if (!goal.parentId || !ids.has(goal.parentId)) roots.push(goal);
      else {
        const siblings = children.get(goal.parentId) ?? [];
        siblings.push(goal);
        children.set(goal.parentId, siblings);
      }
    }
    roots.sort((a, b) => a.position - b.position);
    for (const siblings of children.values())
      siblings.sort((a, b) => a.position - b.position);
    return { roots, children };
  }, [goals]);

  // Measure the rendered cards so connections meet their edges even when a
  // title wraps, a branch is folded, or the layout switches on a narrow screen.
  React.useLayoutEffect(() => {
    const canvas = graph.current;
    if (!canvas) return;
    const measure = () => {
      const origin = canvas.getBoundingClientRect();
      const next: Connection[] = [];
      for (const goal of goals) {
        const child = cards.current.get(goal.id);
        const parent = goal.parentId && cards.current.get(goal.parentId);
        if (!child || !parent) continue;
        const a = parent.getBoundingClientRect();
        const b = child.getBoundingClientRect();
        const x = b.left - origin.left;
        const y = b.top + b.height / 2 - origin.top;
        const horizontal = b.left >= a.right;
        const startX = (horizontal ? a.right : a.left + 16) - origin.left;
        const startY =
          (horizontal ? a.top + a.height / 2 : a.bottom) - origin.top;
        const path = horizontal
          ? `M ${startX} ${startY} C ${startX + 28} ${startY}, ${x - 28} ${y}, ${x} ${y}`
          : `M ${startX} ${startY} L ${startX} ${y - 8} Q ${startX} ${y}, ${startX + 8} ${y} L ${x} ${y}`;
        next.push({ id: goal.id, path, x, y });
      }
      setConnections(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    for (const card of cards.current.values()) observer.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [goals, collapsed]);

  const renderBranch = (goal: Goal, root = false): React.ReactNode => {
    const supporting = children.get(goal.id) ?? [];
    const isCollapsed = collapsed.has(goal.id);
    const Icon = root ? Target : CornerDownRight;
    return (
      <li
        key={goal.id}
        className="flex flex-col items-start md:flex-row md:items-center"
      >
        <div
          ref={(element) => {
            if (element) cards.current.set(goal.id, element);
            else cards.current.delete(goal.id);
          }}
          className="relative z-10 w-60 shrink-0 rounded-lg bg-card text-card-foreground shadow-card"
        >
          <Link
            to="/app/goals"
            search={{
              goal: goal.id,
              archived: archived || undefined,
              view: "hierarchy",
            }}
            aria-label={goal.title}
            title={goal.title}
            className="block rounded-lg px-3 py-3 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <div className="mb-2 flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
              <Icon
                className={root ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5"}
              />
              <span>{root ? "Ongoing goal" : "Supporting goal"}</span>
            </div>
            <div className="line-clamp-3 break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">
              {goal.title}
            </div>
            {goal.description && (
              <p className="mt-1.5 line-clamp-2 break-words text-[13px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {goal.description}
              </p>
            )}
          </Link>
          {supporting.length > 0 && (
            <button
              type="button"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${goal.title}`}
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(goal.id)) next.delete(goal.id);
                  else next.add(goal.id);
                  return next;
                })
              }
              className="flex w-full items-center justify-between gap-2 rounded-b-lg border-t border-border/50 px-3 py-1.5 text-[11px] leading-4 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                {supporting.length} supporting{" "}
                {supporting.length === 1 ? "goal" : "goals"}
              </span>
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
        {supporting.length > 0 && !isCollapsed && (
          <ul className="ml-8 space-y-4 pt-4 md:ml-14 md:pt-0">
            {supporting.map((child) => renderBranch(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section
      aria-label="Goal hierarchy"
      className="overflow-hidden rounded-xl border border-border/60 bg-background"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span>
            {goals.length} {goals.length === 1 ? "goal" : "goals"}
          </span>
          <span aria-hidden="true">·</span>
          <span>Open a goal to focus</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Expand all"
            title="Expand all"
            onClick={() => setCollapsed(new Set())}
            disabled={!children.size}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <UnfoldVertical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Expand all</span>
          </button>
          <button
            type="button"
            aria-label="Collapse all"
            title="Collapse all"
            onClick={() => setCollapsed(new Set(children.keys()))}
            disabled={!children.size}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <FoldVertical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collapse all</span>
          </button>
        </div>
      </div>
      <div
        tabIndex={0}
        aria-label="Scrollable goal map"
        className="max-h-[65vh] min-h-64 overflow-auto bg-canvas/40 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--border) / 0.65) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div ref={graph} className="relative w-max min-w-full p-5 sm:p-8">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible fill-none stroke-muted-foreground/35"
            strokeWidth="1.5"
          >
            {connections.map((connection) => (
              <g key={connection.id}>
                <path d={connection.path} />
                <circle
                  cx={connection.x}
                  cy={connection.y}
                  r="2.5"
                  className="fill-card"
                />
              </g>
            ))}
          </svg>
          <ul className="space-y-8">
            {roots.map((goal) => renderBranch(goal, true))}
          </ul>
        </div>
      </div>
    </section>
  );
}
