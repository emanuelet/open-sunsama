import { describe, expect, it } from "vitest";
import type { Modifier } from "@dnd-kit/core";
import { liftAboveCursor } from "./lift-above-cursor";

describe("liftAboveCursor", () => {
  it("moves the overlay up by half its height plus a gap", () => {
    const result = liftAboveCursor({
      transform: { x: 40, y: 300, scaleX: 1, scaleY: 1 },
      draggingNodeRect: { height: 28 } as DOMRect,
    } as unknown as Parameters<Modifier>[0]);

    expect(result).toMatchObject({ x: 40, y: 264 });
  });
});
