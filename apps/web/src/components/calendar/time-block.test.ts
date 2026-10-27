import { describe, expect, it } from "vitest";
import { blockTooltip } from "./time-block";

describe("blockTooltip", () => {
  it("shows the title followed by its time range", () => {
    expect(
      blockTooltip(
        "Write report",
        new Date(2026, 9, 26, 9),
        new Date(2026, 9, 26, 10, 30)
      )
    ).toBe("Write report\n9:00 AM - 10:30 AM");
  });

  it("formats afternoon blocks with PM", () => {
    expect(
      blockTooltip(
        "Chores",
        new Date(2026, 9, 26, 19),
        new Date(2026, 9, 26, 19, 30)
      )
    ).toBe("Chores\n7:00 PM - 7:30 PM");
  });
});
