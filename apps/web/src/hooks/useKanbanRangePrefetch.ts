import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, subDays } from "date-fns";
import { getApi } from "@/lib/api";
import { taskKeys } from "@/lib/query-keys";
import {
  fetchTaskRange,
  seedDayCaches,
  seedSubtaskCaches,
} from "@/lib/kanban-range-seed";
import { useAuth } from "@/hooks/useAuth";

/**
 * The number of days to prefetch in each direction around the current
 * focused day. Matches the kanban board's BUFFER_DAYS so all visible columns
 * are seeded by a single roundtrip.
 */
const PREFETCH_BUFFER_DAYS = 14;

interface RangePrefetchOptions {
  /**
   * Center date for the prefetch window. Defaults to today.
   */
  centerDate?: Date;
  /**
   * Days to prefetch on each side of `centerDate`.
   */
  bufferDays?: number;
}

/**
 * Fetches the entire visible date range for the kanban board in a single
 * request and seeds the per-day list caches that `DayColumn` reads from.
 *
 * Without this, the kanban makes one request per visible column on first
 * load (today, today+1, today+2, today-1, …). On a wide monitor that's a
 * dozen or more parallel requests and the columns trickle in. With this
 * hook, the columns hydrate together as soon as the range request resolves.
 */
export function useKanbanRangePrefetch(options: RangePrefetchOptions = {}) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Stabilise the center reference. Callers often pass `firstVisibleDate ??
  // new Date()` directly, which allocates a new Date object on every render.
  // We bucket to the YYYY-MM-DD string so the rest of the hook depends on
  // a stable primitive and React Query's cache key never churns.
  const rawCenter = options.centerDate ?? null;
  const centerString = React.useMemo(() => {
    return format(rawCenter ?? new Date(), "yyyy-MM-dd");
  }, [rawCenter ? format(rawCenter, "yyyy-MM-dd") : null]);

  const bufferDays = options.bufferDays ?? PREFETCH_BUFFER_DAYS;
  const fromString = React.useMemo(() => {
    const center = new Date(centerString + "T00:00:00");
    return format(subDays(center, bufferDays), "yyyy-MM-dd");
  }, [centerString, bufferDays]);
  const toString = React.useMemo(() => {
    const center = new Date(centerString + "T00:00:00");
    return format(addDays(center, bufferDays), "yyyy-MM-dd");
  }, [centerString, bufferDays]);

  // Keep this key outside `taskKeys.lists()`: task mutations treat every
  // cache under that prefix as a Task[], and this one holds an object.
  const queryKey = React.useMemo(
    () => taskKeys.range(fromString, toString),
    [fromString, toString]
  );

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchTaskRange(
        (filters) => getApi().tasks.list(filters),
        fromString,
        toString
      ),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const data = query.data;
  const seededFingerprintRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    // If the API truncated the range we cannot trust the per-day projections;
    // skip seeding and let DayColumn fall back to its own per-day fetches.
    if (data.truncated) return;

    // Cheap fingerprint of the response. If the same set of (id, updatedAt)
    // tuples comes back again — typical when React Query revalidates and
    // the data hasn't actually changed — we skip the seeding loop entirely
    // so we don't churn the per-day cache references and re-render every
    // mounted DayColumn.
    let fingerprint = centerString + ":";
    for (const t of data.tasks) {
      fingerprint += t.id;
      const u = t.updatedAt;
      fingerprint += "@" + (u instanceof Date ? u.getTime() : String(u)) + "|";
    }
    if (fingerprint === seededFingerprintRef.current) return;
    seededFingerprintRef.current = fingerprint;

    seedDayCaches(queryClient, queryKey, data, { centerString, bufferDays });

    // Seed the per-task subtask caches too, so the kanban's subtask
    // batcher never has to fire — `useSubtasks(taskId)` will read from
    // these fresh cache entries (within the 60s default staleTime).
    seedSubtaskCaches(queryClient, data);
  }, [data, queryClient, queryKey, bufferDays, centerString]);

  return query;
}
