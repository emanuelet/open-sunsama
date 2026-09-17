import { describe, it, expect } from "vitest";
import {
  isCompletedStatus,
  isCustomTaskId,
  mapChecklistItems,
  mapEstimateMins,
  mapPriority,
  normalizeTask,
  parseClickUpReference,
  parseEpochMs,
  type ClickUpTask,
} from "./clickup-helpers";

function rawTask(overrides: Partial<ClickUpTask> = {}): ClickUpTask {
  return {
    id: "abc123",
    name: "Ship the thing",
    text_content: "Do the work",
    description: "**Do the work**",
    status: { status: "in progress", type: "custom" },
    priority: null,
    time_estimate: null,
    date_updated: "1758000000000",
    due_date: null,
    date_closed: null,
    url: "https://app.clickup.com/t/abc123",
    list: { id: "1", name: "Engineering" },
    ...overrides,
  };
}

describe("mapPriority", () => {
  it("maps ClickUp's four levels onto P0-P3", () => {
    expect(mapPriority({ id: "1", priority: "urgent" })).toBe("P0");
    expect(mapPriority({ id: "2", priority: "high" })).toBe("P1");
    expect(mapPriority({ id: "3", priority: "normal" })).toBe("P2");
    expect(mapPriority({ id: "4", priority: "low" })).toBe("P3");
  });

  it("falls back to the label when the id is unrecognized", () => {
    expect(mapPriority({ id: "99", priority: "High" })).toBe("P1");
  });

  it("returns null when no priority is set, so the caller keeps its default", () => {
    expect(mapPriority(null)).toBeNull();
    expect(mapPriority({ id: "99", priority: "weird" })).toBeNull();
  });
});

describe("mapEstimateMins", () => {
  it("converts milliseconds to whole minutes", () => {
    expect(mapEstimateMins(3_600_000)).toBe(60);
    expect(mapEstimateMins(1_800_000)).toBe(30);
  });

  it("returns null rather than an invalid zero estimate", () => {
    // The task schema requires a positive integer, so a sub-30-second
    // estimate has to become null, not 0.
    expect(mapEstimateMins(0)).toBeNull();
    expect(mapEstimateMins(null)).toBeNull();
    expect(mapEstimateMins(-5)).toBeNull();
    expect(mapEstimateMins(1000)).toBeNull();
  });
});

describe("isCompletedStatus", () => {
  it("uses status.type, not the workspace's custom label", () => {
    expect(isCompletedStatus({ status: "shipped ✅", type: "closed" })).toBe(
      true
    );
    expect(isCompletedStatus({ status: "done", type: "done" })).toBe(true);
    expect(isCompletedStatus({ status: "in progress", type: "custom" })).toBe(
      false
    );
    expect(isCompletedStatus({ status: "to do", type: "open" })).toBe(false);
    expect(isCompletedStatus(null)).toBe(false);
  });
});

describe("parseEpochMs", () => {
  it("parses epoch milliseconds sent as a string", () => {
    expect(parseEpochMs("1758000000000")?.toISOString()).toBe(
      new Date(1758000000000).toISOString()
    );
  });

  it("returns null for absent or junk values", () => {
    expect(parseEpochMs(null)).toBeNull();
    expect(parseEpochMs("")).toBeNull();
    expect(parseEpochMs("not-a-number")).toBeNull();
    expect(parseEpochMs("0")).toBeNull();
  });
});

describe("normalizeTask", () => {
  it("prefers plain text over the markup description", () => {
    expect(normalizeTask(rawTask()).description).toBe("Do the work");
  });

  it("falls back to description when text_content is empty", () => {
    expect(normalizeTask(rawTask({ text_content: "" })).description).toBe(
      "**Do the work**"
    );
  });

  it("carries the list name through for the card's source chip", () => {
    expect(normalizeTask(rawTask()).containerName).toBe("Engineering");
  });

  it("keeps the due date without ever implying a schedule", () => {
    const task = normalizeTask(rawTask({ due_date: "1758000000000" }));
    expect(task.dueDate).toBeInstanceOf(Date);
  });
});

describe("mapChecklistItems", () => {
  it("flattens items and respects orderindex", () => {
    const items = mapChecklistItems([
      {
        id: "cl1",
        name: "Checks",
        orderindex: 0,
        items: [
          { id: "i2", name: "Second", resolved: false, orderindex: 1 },
          { id: "i1", name: "First", resolved: true, orderindex: 0 },
        ],
      },
    ]);

    expect(items.map((i) => i.title)).toEqual(["First", "Second"]);
    expect(items.map((i) => i.position)).toEqual([0, 1]);
    expect(items[0]!.completed).toBe(true);
  });

  it("prefixes with the checklist name only when there is more than one", () => {
    const single = mapChecklistItems([
      {
        id: "cl1",
        name: "QA",
        orderindex: 0,
        items: [{ id: "i1", name: "Test it", resolved: false, orderindex: 0 }],
      },
    ]);
    expect(single[0]!.title).toBe("Test it");

    const multiple = mapChecklistItems([
      {
        id: "cl1",
        name: "QA",
        orderindex: 0,
        items: [{ id: "i1", name: "Test it", resolved: false, orderindex: 0 }],
      },
      {
        id: "cl2",
        name: "Release",
        orderindex: 1,
        items: [{ id: "i2", name: "Tag it", resolved: false, orderindex: 0 }],
      },
    ]);
    expect(multiple.map((i) => i.title)).toEqual(["QA: Test it", "Release: Tag it"]);
  });

  it("returns nothing when there are no checklists", () => {
    expect(mapChecklistItems(undefined)).toEqual([]);
    expect(mapChecklistItems([])).toEqual([]);
  });
});

describe("parseClickUpReference", () => {
  it("pulls the task id out of a task URL", () => {
    expect(parseClickUpReference("https://app.clickup.com/t/86abc1234")).toBe(
      "86abc1234"
    );
  });

  it("takes the last segment of a team-scoped custom-id URL", () => {
    // /t/{team_id}/{custom_task_id} — the team id must not be mistaken
    // for the task.
    expect(
      parseClickUpReference("https://app.clickup.com/t/9008123456/ABC-123")
    ).toBe("ABC-123");
  });

  it("ignores query strings and fragments", () => {
    expect(
      parseClickUpReference(
        "https://app.clickup.com/t/86abc1234?comment=99#thread"
      )
    ).toBe("86abc1234");
  });

  it("accepts a bare native id", () => {
    expect(parseClickUpReference("86abc1234")).toBe("86abc1234");
  });

  it("accepts a bare custom id", () => {
    expect(parseClickUpReference("ABC-123")).toBe("ABC-123");
  });

  it("trims surrounding whitespace from a paste", () => {
    expect(parseClickUpReference("  86abc1234\n")).toBe("86abc1234");
  });

  it("rejects a non-ClickUp host", () => {
    // Otherwise a Gitea or Jira link would be handed to the ClickUp API.
    expect(
      parseClickUpReference("https://evil.example.com/t/86abc1234")
    ).toBeNull();
  });

  it("rejects a ClickUp URL that isn't a task", () => {
    expect(
      parseClickUpReference("https://app.clickup.com/1234567/v/li/9876")
    ).toBeNull();
  });

  it("rejects junk", () => {
    expect(parseClickUpReference("")).toBeNull();
    expect(parseClickUpReference("   ")).toBeNull();
    expect(parseClickUpReference("just some words")).toBeNull();
  });
});

describe("isCustomTaskId", () => {
  it("recognizes the PREFIX-123 shape", () => {
    expect(isCustomTaskId("ABC-123")).toBe(true);
    expect(isCustomTaskId("DEV-1")).toBe(true);
  });

  it("does not mistake a native id for a custom one", () => {
    // Native ids need no team_id; treating one as custom sends a
    // pointless request per workspace.
    expect(isCustomTaskId("86abc1234")).toBe(false);
    expect(isCustomTaskId("ABC-")).toBe(false);
    expect(isCustomTaskId("-123")).toBe(false);
  });
});
