/**
 * ClickUp API v2 response shapes and the normalizers that turn them
 * into the provider-neutral `ExternalTask`.
 *
 * Kept separate from `clickup.ts` (the `google-helpers.ts` convention)
 * so the mapping rules are unit-testable without touching the network.
 */
import { z } from "zod";
import type { TaskPriority } from "@open-sunsama/database";
import type { ExternalSubtask, ExternalTask } from "./index";

export const clickUpCredentialSchema = z.object({
  /** Personal API token. ClickUp issues these prefixed `pk_`. */
  token: z.string().min(10, "Token looks too short"),
  /**
   * Workspace ids discovered at verify time. Needed to resolve custom
   * task ids ("ABC-123"), which ClickUp only accepts alongside a team id.
   */
  teamIds: z.array(z.string()).optional(),
});

export type ClickUpCredentials = z.infer<typeof clickUpCredentialSchema>;

// --- Raw API shapes -------------------------------------------------

export interface ClickUpUser {
  id: number;
  username: string | null;
  email: string | null;
}

export interface ClickUpUserResponse {
  user: ClickUpUser;
}

export interface ClickUpTeam {
  id: string;
  name: string;
}

export interface ClickUpTeamsResponse {
  teams: ClickUpTeam[];
}

export interface ClickUpStatus {
  status: string;
  /** "open" | "custom" | "closed" | "done" */
  type: string;
}

export interface ClickUpTaskList {
  id: string;
  name: string | null;
}

export interface ClickUpTask {
  id: string;
  name: string;
  /** Plain-text body. `description` is the markdown-ish variant. */
  text_content: string | null;
  description: string | null;
  status: ClickUpStatus | null;
  /**
   * ClickUp sends priority as an object whose `priority` field is the
   * *label* ("urgent"), and `id` is the numeric level as a string.
   * Null means "no priority set".
   */
  priority: { id: string; priority: string } | null;
  /** Milliseconds. */
  time_estimate: number | null;
  /** Epoch milliseconds, as a string. */
  date_updated: string | null;
  due_date: string | null;
  date_closed: string | null;
  url: string;
  list: ClickUpTaskList | null;
}

export interface ClickUpChecklistItem {
  id: string;
  name: string;
  resolved: boolean;
  orderindex: number;
}

export interface ClickUpChecklist {
  id: string;
  name: string;
  orderindex: number;
  items: ClickUpChecklistItem[];
}

export interface ClickUpTaskDetail extends ClickUpTask {
  checklists?: ClickUpChecklist[];
}

// --- Normalizers ----------------------------------------------------

/**
 * ClickUp's four fixed priority levels map onto our P0–P3 one-to-one.
 * A task with no priority set returns null so the caller can fall back
 * to the schema default (P2) on create without overwriting a local
 * choice on update.
 */
const PRIORITY_BY_ID: Record<string, TaskPriority> = {
  "1": "P0", // urgent
  "2": "P1", // high
  "3": "P2", // normal
  "4": "P3", // low
};

const PRIORITY_BY_LABEL: Record<string, TaskPriority> = {
  urgent: "P0",
  high: "P1",
  normal: "P2",
  low: "P3",
};

export function mapPriority(
  priority: ClickUpTask["priority"]
): TaskPriority | null {
  if (!priority) return null;
  return (
    PRIORITY_BY_ID[priority.id] ??
    PRIORITY_BY_LABEL[priority.priority?.toLowerCase() ?? ""] ??
    null
  );
}

/**
 * `time_estimate` is milliseconds. We store whole minutes, and the
 * task schema requires a positive integer, so anything that rounds to
 * zero becomes null rather than an invalid 0.
 */
export function mapEstimateMins(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined || ms <= 0) return null;
  const mins = Math.round(ms / 60_000);
  return mins > 0 ? mins : null;
}

/**
 * ClickUp lets a workspace define its own status names, so the label is
 * useless for deciding completion. `type` is the stable field: every
 * custom status resolves to one of open/custom/closed/done.
 */
export function isCompletedStatus(status: ClickUpStatus | null): boolean {
  const type = status?.type?.toLowerCase();
  return type === "closed" || type === "done";
}

/** Epoch-milliseconds-as-a-string → Date. */
export function parseEpochMs(value: string | null | undefined): Date | null {
  if (!value) return null;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms);
}

export function mapChecklistItems(
  checklists: ClickUpChecklist[] | undefined
): ExternalSubtask[] {
  if (!checklists?.length) return [];

  return checklists
    .slice()
    .sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0))
    .flatMap((checklist) =>
      (checklist.items ?? [])
        .slice()
        .sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0))
        .map((item) => ({
          externalId: item.id,
          // Prefix with the checklist name when a task has more than
          // one, otherwise the items lose their grouping entirely.
          title:
            checklists.length > 1 && checklist.name
              ? `${checklist.name}: ${item.name}`
              : item.name,
          completed: Boolean(item.resolved),
          position: 0,
        }))
    )
    .map((item, index) => ({ ...item, position: index }));
}

/**
 * Turn one raw ClickUp task into the provider-neutral shape. The caller
 * fills in `subtasks` from the detail payload's checklists.
 */
export function normalizeTask(raw: ClickUpTask): ExternalTask {
  const dueDate = parseEpochMs(raw.due_date);
  const remoteUpdatedAt = parseEpochMs(raw.date_updated) ?? new Date(0);

  return {
    externalId: raw.id,
    title: raw.name,
    // `text_content` is the plain-text rendering; prefer it so the
    // notes field does not fill up with ClickUp's markup.
    description: raw.text_content || raw.description || null,
    priority: mapPriority(raw.priority),
    estimatedMins: mapEstimateMins(raw.time_estimate),
    isCompleted: isCompletedStatus(raw.status),
    statusName: raw.status?.status ?? null,
    dueDate,
    url: raw.url,
    containerName: raw.list?.name ?? null,
    remoteUpdatedAt,
    subtasks: [],
  };
}

/**
 * A ClickUp custom task id, e.g. "ABC-123". The API only resolves these
 * when `custom_task_ids=true` and a `team_id` are supplied, so they have
 * to be recognizable by shape.
 */
export function isCustomTaskId(id: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(id);
}

/** A native ClickUp task id: lowercase alphanumeric, no separators. */
function isNativeTaskId(id: string): boolean {
  return /^[a-z0-9]{6,20}$/i.test(id);
}

/**
 * Pull a task id out of whatever the user pasted.
 *
 * Recognized:
 *   https://app.clickup.com/t/86abc1234
 *   https://app.clickup.com/t/9008123456/ABC-123   (team id, then custom id)
 *   https://app.clickup.com/t/86abc1234?comment=1  (query/fragment ignored)
 *   86abc1234
 *   ABC-123
 *
 * Returns null for anything else, which is how the import route decides
 * that a different provider (or none) should handle the input.
 */
export function parseClickUpReference(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    if (!/(^|\.)clickup\.com$/i.test(url.hostname)) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    const tIndex = segments.indexOf("t");
    if (tIndex === -1) return null;

    const after = segments.slice(tIndex + 1);
    if (after.length === 0) return null;

    // /t/{task_id} or /t/{team_id}/{custom_task_id} — the last segment
    // is the task either way.
    const candidate = after[after.length - 1]!;
    return isCustomTaskId(candidate) || isNativeTaskId(candidate)
      ? candidate
      : null;
  }

  // A bare id pasted straight in.
  if (isCustomTaskId(trimmed) || isNativeTaskId(trimmed)) return trimmed;

  return null;
}
