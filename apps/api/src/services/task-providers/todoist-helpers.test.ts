import { describe, expect, it } from "vitest";
import {
  mapEstimateMins,
  mapPriority,
  normalizeTask,
  parseTodoistReference,
  type TodoistTask,
} from "./todoist-helpers";

function rawTask(overrides: Partial<TodoistTask> = {}): TodoistTask {
  return {
    id: "6cF5Q2gH9P3",
    project_id: "6cF5Project",
    content: "Ship the thing",
    description: "Do the work",
    priority: 4,
    checked: false,
    completed_at: null,
    updated_at: "2026-09-01T10:00:00Z",
    due: null,
    duration: null,
    ...overrides,
  };
}

describe("mapPriority", () => {
  it("maps Todoist's highest-first scale onto P0-P3", () => {
    expect(mapPriority(4)).toBe("P0");
    expect(mapPriority(3)).toBe("P1");
    expect(mapPriority(2)).toBe("P2");
    expect(mapPriority(1)).toBe("P3");
    expect(mapPriority(0)).toBeNull();
  });
});

describe("mapEstimateMins", () => {
  it("uses minute durations and leaves day durations unset", () => {
    expect(mapEstimateMins({ amount: 45, unit: "minute" })).toBe(45);
    expect(mapEstimateMins({ amount: 1, unit: "day" })).toBeNull();
    expect(mapEstimateMins(null)).toBeNull();
  });
});

describe("normalizeTask", () => {
  it("maps Todoist fields without scheduling the local task", () => {
    const task = normalizeTask(
      rawTask({ due: { date: "2026-09-02" }, duration: { amount: 30, unit: "minute" } }),
      { id: "6cF5Project", name: "Engineering" }
    );

    expect(task).toMatchObject({
      externalId: "6cF5Q2gH9P3",
      priority: "P0",
      estimatedMins: 30,
      isCompleted: false,
      statusName: "open",
      containerName: "Engineering",
      subtasks: [],
    });
    expect(task.dueDate).toBeInstanceOf(Date);
    expect(task.url).toBe("https://app.todoist.com/app/task/6cF5Q2gH9P3");
  });

  it("preserves a completed task state when returned by the API", () => {
    expect(normalizeTask(rawTask({ checked: true }), null).isCompleted).toBe(true);
  });
});

describe("parseTodoistReference", () => {
  it("recognizes Todoist task URLs and bare ids", () => {
    expect(parseTodoistReference("https://app.todoist.com/app/task/6cF5Q2gH9P3")).toBe(
      "6cF5Q2gH9P3"
    );
    expect(parseTodoistReference("  6cF5Q2gH9P3\n")).toBe("6cF5Q2gH9P3");
  });

  it("rejects non-task URLs and unrecognizable ids", () => {
    expect(parseTodoistReference("https://app.todoist.com/app/project/6cF5Q2gH9P3")).toBeNull();
    expect(parseTodoistReference("https://example.com/app/task/6cF5Q2gH9P3")).toBeNull();
    expect(parseTodoistReference("not a task")).toBeNull();
  });
});
