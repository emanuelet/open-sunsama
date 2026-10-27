import type { Modifier } from "@dnd-kit/core";

/** Lifts a drag overlay clear above the cursor and calendar drop preview. */
export const liftAboveCursor: Modifier = ({ transform, draggingNodeRect }) => ({
  ...transform,
  y: transform.y - (draggingNodeRect?.height ?? 0) / 2 - 22,
});
