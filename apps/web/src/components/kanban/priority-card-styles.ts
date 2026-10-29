import type { TaskPriority } from "@open-sunsama/types";

/** Subtle priority tints shared by task cards in light and dark themes. */
export const PRIORITY_CARD_BACKGROUND: Record<TaskPriority, string> = {
  P0: "bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60",
  P1: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/60",
  P2: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60",
  P3: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800/70",
};
