import * as React from "react";

/**
 * Subtask rows come in two sizes: "md" for side panels and forms, "lg" for
 * the task modal and focus mode, where they sit under a large title as in
 * Sunsama. The size is set once around a list instead of on every row.
 */
export type SubtaskSize = "md" | "lg";

export const SubtaskSizeContext = React.createContext<SubtaskSize>("md");

export const SUBTASK_STYLES = {
  md: {
    row: "min-h-8 gap-2.5 py-1.5",
    check: "h-4 w-4",
    checkOffset: "mt-0.5",
    checkTarget: "",
    checkIcon: "h-2.5 w-2.5",
    text: "text-sm leading-5",
  },
  lg: {
    row: "min-h-9 gap-3.5 py-1.5 max-lg:-mr-3 max-lg:min-h-11 max-lg:py-0 max-lg:pr-0",
    check:
      "h-5 w-5 max-lg:aria-[checked=false]:border-muted-foreground/75 max-lg:aria-[checked=false]:[&>svg]:invisible",
    checkOffset: "mt-0.5 max-lg:mt-3",
    checkTarget:
      "relative focus-visible:ring-1 focus-visible:ring-ring max-lg:before:absolute max-lg:before:-inset-[13px]",
    checkIcon: "h-3 w-3",
    text: "text-base leading-6",
  },
} as const;

export function useSubtaskSize() {
  return React.useContext(SubtaskSizeContext);
}

export function useSubtaskStyles() {
  return SUBTASK_STYLES[React.useContext(SubtaskSizeContext)];
}

/** Unchecked circles show a faint check, like Sunsama's. */
export const subtaskCheckState = (completed: boolean) =>
  completed
    ? "border-emerald-500 bg-emerald-500 text-white"
    : "border-muted-foreground/40 text-muted-foreground/40 hover:border-emerald-500 hover:text-emerald-500";
