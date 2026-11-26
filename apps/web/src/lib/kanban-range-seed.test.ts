import { QueryClient } from "@tanstack/react-query";
import type { Task } from "@open-sunsama/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskKeys } from "./query-keys";
import {
  dayCacheKey,
  fetchTaskRange,
  seedDayCaches,
  seedSubtaskCaches,
} from "./kanban-range-seed";
import { subtaskKeys } from "./query-keys";
import type { Subtask } from "@open-sunsama/types";

const DAY = "2026-11-20";
const rangeKey = taskKeys.range("2026-11-19", "2026-11-21");

function task(id: string): Task {
  const at = new Date("2026-11-20T08:00:00Z");
  return {
    id,
    userId: "u1",
    title: id,
    notes: null,
    scheduledDate: DAY,
    estimatedMins: null,
    actualMins: 0,
    priority: "P2",
    position: 0,
    completedAt: null,
    subtasksHidden: false,
    seriesId: null,
    seriesInstanceNumber: null,
    timerStartedAt: null,
    timerAccumulatedSeconds: 0,
    createdAt: at,
    updatedAt: at,
  };
}

/** Runs the range query; the server answers with `serverTasks` when `respond()` is called. */
function startRangeFetch(qc: QueryClient, serverTasks: Task[]) {
  let respond!: () => void;
  const listTasks = () =>
    new Promise<{ data: Task[]; meta: { total: number } }>((resolve) => {
      respond = () =>
        resolve({ data: serverTasks, meta: { total: serverTasks.length } });
    });
  const done = qc.fetchQuery({
    queryKey: rangeKey,
    queryFn: () => fetchTaskRange(listTasks, "2026-11-19", "2026-11-21"),
  });
  return { respond: () => respond(), done };
}

describe("seedDayCaches", () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    qc = new QueryClient();
  });

  afterEach(() => {
    qc.clear();
    vi.useRealTimers();
  });

  it("keeps a task created while an older range fetch was in flight", async () => {
    vi.setSystemTime(1_000);
    qc.setQueryData(dayCacheKey(DAY), [task("a")]);

    // The range request starts; the server reads its data before the create.
    vi.setSystemTime(2_000);
    const range = startRangeFetch(qc, [task("a")]);

    // Quick add lands: useCreateTask swaps the placeholder for the server task.
    vi.setSystemTime(3_000);
    qc.setQueryData(dayCacheKey(DAY), [task("a"), task("new")]);

    // The older range response arrives afterwards.
    vi.setSystemTime(4_000);
    range.respond();
    const data = await range.done;

    seedDayCaches(qc, rangeKey, data, { centerString: DAY, bufferDays: 1 });

    expect(qc.getQueryData<Task[]>(dayCacheKey(DAY))?.map((t) => t.id)).toEqual(
      ["a", "new"]
    );
  });

  it("refreshes a day cache written before the range fetch started", async () => {
    vi.setSystemTime(1_000);
    qc.setQueryData(dayCacheKey(DAY), [task("a")]);

    vi.setSystemTime(2_000);
    const range = startRangeFetch(qc, [task("a"), task("from-elsewhere")]);
    vi.setSystemTime(3_000);
    range.respond();
    const data = await range.done;

    seedDayCaches(qc, rangeKey, data, { centerString: DAY, bufferDays: 1 });

    expect(qc.getQueryData<Task[]>(dayCacheKey(DAY))?.map((t) => t.id)).toEqual(
      ["a", "from-elsewhere"]
    );
  });

  it("keeps subtasks saved while an older range fetch was in flight", async () => {
    vi.setSystemTime(2_000);
    const range = startRangeFetch(qc, [task("new")]);

    // The composer saves a subtask after the range request started.
    vi.setSystemTime(3_000);
    const sub = { id: "s1", taskId: "new" } as Subtask;
    qc.setQueryData(subtaskKeys.list("new"), [sub]);

    vi.setSystemTime(4_000);
    range.respond();
    const data = await range.done;
    seedSubtaskCaches(qc, { ...data, subtasksByTaskId: { new: [] } });

    expect(qc.getQueryData<Subtask[]>(subtaskKeys.list("new"))).toEqual([sub]);
  });

  it("lets a newer range replace subtasks seeded from an older one", () => {
    const sub = { id: "s1", taskId: "new" } as Subtask;
    const range = (fetchStartedAt: number, subs: Subtask[]) => ({
      tasks: [task("new")],
      subtasksByTaskId: { new: subs },
      truncated: false,
      fetchStartedAt,
    });

    // An older range (started at 2s) is seeded at 4s, while a newer range
    // (started at 3s, after the subtask was saved) is still in flight.
    vi.setSystemTime(4_000);
    seedSubtaskCaches(qc, range(2_000, []));

    vi.setSystemTime(5_000);
    seedSubtaskCaches(qc, range(3_000, [sub]));

    expect(qc.getQueryData<Subtask[]>(subtaskKeys.list("new"))).toEqual([sub]);
  });
});
