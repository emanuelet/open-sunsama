import type { QueryClient } from "@tanstack/react-query";
import type { Task, Subtask, TaskFilterInput } from "@open-sunsama/types";
import { addDays, format } from "date-fns";
import { taskKeys, subtaskKeys } from "@/lib/query-keys";

export interface TaskRangeData {
  tasks: Task[];
  /**
   * Plain record, not a Map: this query's result is persisted to
   * localStorage, and a Map does not survive JSON round-tripping —
   * it comes back as `{}` and every consumer that iterates it
   * throws on the next page load.
   */
  subtasksByTaskId: Record<string, Subtask[]>;
  truncated: boolean;
  /**
   * When the range queryFn started (epoch ms). The server read its data at
   * some point after this, so anything a day cache got before it is already
   * in the range, and anything after it may not be. Missing on entries
   * persisted by older builds.
   */
  fetchStartedAt?: number;
}

// The shape the server returns when `includeSubtasks=true` is set. The
// canonical Task type doesn't carry a `subtasks` field — we strip it back
// out before seeding the per-day caches so consumers see plain Tasks.
type TaskWithSubtasks = Task & { subtasks?: Subtask[] };

type ListTasks = (filters: TaskFilterInput) => Promise<{
  data?: Task[];
  meta?: { total?: number };
}>;

/**
 * Page size for the range fetch. Must stay at or under the API's `limit` cap
 * for `GET /tasks` (500, `taskFilterSchema` in apps/api); anything higher is
 * rejected with a 400 and the board silently loses the prefetch.
 */
const RANGE_PAGE_SIZE = 500;

/**
 * Most pages we'll fetch for one range (5,000 tasks). Past this we stop and
 * refuse to seed, because some days inside the range would be truncated and
 * seeding would hide tasks from the user.
 */
const RANGE_MAX_PAGES = 10;

/** The kanban range query's queryFn. */
export async function fetchTaskRange(
  listTasks: ListTasks,
  from: string,
  to: string
): Promise<TaskRangeData> {
  const fetchStartedAt = Date.now();
  const fetchPage = (page: number) =>
    listTasks({
      scheduledDateFrom: from,
      scheduledDateTo: to,
      limit: RANGE_PAGE_SIZE,
      page,
      includeSubtasks: true,
    });

  // Almost every range fits in the first page. Busier ones fetch the
  // remaining pages in parallel.
  const first = await fetchPage(1);
  const total = first.meta?.total ?? first.data?.length ?? 0;
  const pageCount = Math.min(
    Math.ceil(total / RANGE_PAGE_SIZE),
    RANGE_MAX_PAGES
  );
  const rest = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, i) =>
      fetchPage(i + 2)
    )
  );
  const raw = [first, ...rest].flatMap(
    (r) => (r.data ?? []) as TaskWithSubtasks[]
  );

  // Strip subtasks off the task object before we put it in the per-day
  // cache. We seed the subtask caches separately.
  const tasks: Task[] = [];
  const subtasksByTaskId: Record<string, Subtask[]> = {};
  for (const t of raw) {
    const { subtasks: embedded, ...task } = t;
    tasks.push(task as Task);
    if (embedded) subtasksByTaskId[t.id] = embedded;
  }

  // A task created or deleted between pages shifts the offsets, so the
  // count can disagree with `total`; treat any mismatch as truncated.
  return {
    tasks,
    subtasksByTaskId,
    truncated: total !== tasks.length,
    fetchStartedAt,
  };
}

/**
 * Per-day cache key used by `DayColumn` (`useTasks({ scheduledDate, limit: 200 })`).
 * We reproduce it here so we can seed the cache by hand from the range query.
 */
export function dayCacheKey(dateString: string) {
  return taskKeys.list({ scheduledDate: dateString, limit: 200 });
}

/**
 * Cheap reference check by id+updatedAt to avoid re-seeding caches that
 * already hold the equivalent data.
 */
function tasksAreEqual(a: Task[], b: Task[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.id !== y.id) return false;
    const xu = x.updatedAt;
    const yu = y.updatedAt;
    const xt = xu instanceof Date ? xu.getTime() : String(xu);
    const yt = yu instanceof Date ? yu.getTime() : String(yu);
    if (xt !== yt) return false;
  }
  return true;
}

/**
 * Write the range query's tasks into each per-day cache in
 * `centerString ± bufferDays`, skipping days that hold an optimistic insert
 * or were written after the range request started.
 */
export function seedDayCaches(
  queryClient: QueryClient,
  rangeKey: readonly unknown[],
  data: TaskRangeData,
  { centerString, bufferDays }: { centerString: string; bufferDays: number }
) {
  // Compare against when the request started, not when its response
  // arrived (`dataUpdatedAt`): a create that lands in between is missing
  // from the response but newer than it. Entries persisted by older builds
  // have no start time, so fall back to the arrival time for those.
  const rangeStartedAt =
    data.fetchStartedAt ??
    queryClient.getQueryState(rangeKey)?.dataUpdatedAt ??
    Date.now();

  const byDate = new Map<string, Task[]>();
  for (const task of data.tasks) {
    if (!task.scheduledDate) continue;
    const arr = byDate.get(task.scheduledDate);
    if (arr) arr.push(task);
    else byDate.set(task.scheduledDate, [task]);
  }

  const center = new Date(centerString + "T00:00:00");

  for (let i = -bufferDays; i <= bufferDays; i++) {
    const key = format(addDays(center, i), "yyyy-MM-dd");
    const dayTasks = byDate.get(key) ?? [];
    const cacheKey = dayCacheKey(key);
    const existing = queryClient.getQueryData<Task[]>(cacheKey);

    // Never clobber an in-flight optimistic insert.
    if (existing && existing.some((t) => t.id.startsWith("optimistic-"))) {
      continue;
    }

    // A day cache written after the range request started (a create, a
    // move, its own fetch) is newer than what the server read for the
    // range, so the range must not overwrite it.
    const dayState = queryClient.getQueryState(cacheKey);
    if (
      existing &&
      dayState?.dataUpdatedAt &&
      dayState.dataUpdatedAt >= rangeStartedAt
    ) {
      continue;
    }

    // Skip writes that wouldn't actually change the cache contents.
    if (existing && tasksAreEqual(existing, dayTasks)) {
      continue;
    }

    // Stamp it with when the range started, not now, so a newer range
    // (started after this one) is still allowed to replace it.
    queryClient.setQueryData(cacheKey, dayTasks, { updatedAt: rangeStartedAt });
  }
}

/**
 * Write the range query's subtasks into each per-task subtask cache, with
 * the same guards as the day caches: subtasks added after the range request
 * started (the composer saves them right after the task) must survive.
 */
export function seedSubtaskCaches(
  queryClient: QueryClient,
  data: TaskRangeData
) {
  // `?? {}` guards a cache entry persisted by an older build, where this
  // field was a Map and rehydrates as undefined or a bare object.
  for (const [taskId, list] of Object.entries(data.subtasksByTaskId ?? {})) {
    const cacheKey = subtaskKeys.list(taskId);
    const existing = queryClient.getQueryData<Subtask[]>(cacheKey);
    if (existing && existing.some((s) => s.id.startsWith("optimistic-"))) {
      continue;
    }
    const updatedAt = queryClient.getQueryState(cacheKey)?.dataUpdatedAt;
    if (
      existing &&
      data.fetchStartedAt !== undefined &&
      updatedAt &&
      updatedAt >= data.fetchStartedAt
    ) {
      continue;
    }
    queryClient.setQueryData(cacheKey, list, {
      updatedAt: data.fetchStartedAt,
    });
  }
}
