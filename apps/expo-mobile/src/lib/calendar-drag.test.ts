import { describe, expect, test } from "vitest";
import { calendarDragOffset } from "./calendar-drag";

describe("calendar drag snapping", () => {
  test("snaps movement to the nearest quarter hour", () => {
    expect(calendarDragOffset(540, 60, 20, 60)).toBe(15);
    expect(calendarDragOffset(540, 60, -35, 60)).toBe(-30);
  });
  test("keeps the complete block within the selected day", () => {
    expect(calendarDragOffset(60, 90, -200, 60)).toBe(-60);
    expect(calendarDragOffset(1320, 60, 300, 60)).toBe(60);
  });
});
