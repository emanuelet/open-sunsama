/**
 * Manual task import.
 *
 * The user pastes a link or an id; we fetch that one task and create a
 * local task linked back to it. Later they may hit refresh on that task
 * to pull current values again.
 *
 * Two rules:
 *
 *  1. **Imported tasks land in the backlog.** The remote due date is
 *     stored on the link for display, but never sets `scheduledDate` —
 *     the user decides which day their work happens on.
 *
 *  2. **A refresh never touches local planning.** It overwrites the
 *     fields that came from the provider and nothing else, so scheduling,
 *     ordering and tracked time survive.
 */
import { getDb, and, eq, isNull, sql } from "@open-sunsama/database";
import {
  integrationAccounts,
  subtasks,
  taskExternalLinks,
  tasks,
  type ExternalLinkMeta,
  type IntegrationAccount,
  type Task,
  type TaskExternalLink,
} from "@open-sunsama/database/schema";
import { decrypt } from "./encryption.js";
import {
  getTaskProvider,
  ProviderTaskNotFoundError,
  type ExternalSubtask,
  type ExternalTask,
} from "./task-providers/index.js";

/**
 * The only task columns an import or refresh may write. Everything else
 * is local-only by construction. Keeping the list in one place — and
 * asserting on it in tests — is what makes rule 2 auditable rather than
 * a comment somebody quietly breaks.
 */
export const IMPORTED_TASK_FIELDS = [
  "title",
  "notes",
  "estimatedMins",
  "priority",
  "completedAt",
] as const;

/** Fields that belong to the user's planning and must never be written. */
export const LOCAL_ONLY_TASK_FIELDS = [
  "scheduledDate",
  "position",
  "actualMins",
  "timerStartedAt",
  "timerAccumulatedSeconds",
  "subtasksHidden",
] as const;

export interface ImportedTaskPatch {
  title: string;
  notes: string | null;
  estimatedMins: number | null;
  priority: string;
  completedAt: Date | null;
}

/**
 * Build the patch to apply to a linked local task from fresh remote
 * values. Pure, so the "local planning is untouchable" rule can be
 * tested without a database.
 */
export function buildImportedTaskPatch(
  external: ExternalTask,
  current: { priority: string; completedAt: Date | null },
  now: Date = new Date()
): ImportedTaskPatch {
  return {
    title: external.title.slice(0, 500),
    notes: external.description,
    estimatedMins: external.estimatedMins,
    // No remote priority means "not set upstream", which must not stomp
    // a priority the user chose locally.
    priority: external.priority ?? current.priority,
    // Preserve the original completion timestamp when it was already
    // complete, so "finished at" does not jump forward on every refresh.
    completedAt: external.isCompleted ? (current.completedAt ?? now) : null,
  };
}

export function buildLinkMeta(external: ExternalTask): ExternalLinkMeta {
  return {
    containerName: external.containerName,
    statusName: external.statusName,
    dueDate: external.dueDate
      ? external.dueDate.toISOString().slice(0, 10)
      : null,
  };
}

export interface ImportResult {
  task: Task;
  link: TaskExternalLink;
  /** True when the reference was already imported and we returned it. */
  alreadyExisted: boolean;
}

/**
 * Resolve a pasted reference against the user's connected accounts.
 *
 * Providers recognize their own URL shapes, so the right account falls
 * out of the parse rather than needing the user to pick one.
 */
export async function resolveReference(
  userId: string,
  input: string
): Promise<{ account: IntegrationAccount; externalId: string } | null> {
  const db = getDb();

  const accounts = await db
    .select()
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.userId, userId),
        eq(integrationAccounts.isActive, true)
      )
    );

  for (const account of accounts) {
    const provider = getTaskProvider(account.provider);
    const externalId = provider.parseReference(input);
    if (externalId) return { account, externalId };
  }

  return null;
}

/**
 * Import one external task as a new local task.
 *
 * Idempotent: pasting the same link twice returns the task created the
 * first time rather than making a duplicate.
 */
export async function importExternalTask(
  userId: string,
  account: IntegrationAccount,
  externalId: string
): Promise<ImportResult> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(taskExternalLinks)
    .where(
      and(
        eq(taskExternalLinks.accountId, account.id),
        eq(taskExternalLinks.externalId, externalId)
      )
    )
    .limit(1);

  if (existing) {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, existing.taskId))
      .limit(1);

    if (task) {
      return { task, link: existing, alreadyExisted: true };
    }

    // The local task was deleted. Drop the stale link so the import
    // below can recreate it cleanly.
    await db
      .delete(taskExternalLinks)
      .where(eq(taskExternalLinks.id, existing.id));
  }

  const provider = getTaskProvider(account.provider);
  const credentials = JSON.parse(decrypt(account.credentialsEncrypted));
  const external = await provider.fetchTask(credentials, externalId);

  const now = new Date();
  const position = await nextBacklogPosition(userId);

  const [task] = await db
    .insert(tasks)
    .values({
      userId,
      title: external.title.slice(0, 500),
      notes: external.description,
      // Always the backlog — see rule 1.
      scheduledDate: null,
      estimatedMins: external.estimatedMins,
      priority: external.priority ?? "P2",
      completedAt: external.isCompleted ? now : null,
      position,
    })
    .returning();

  if (!task) {
    throw new Error("Failed to create task from import");
  }

  await mergeSubtasks(task.id, external.subtasks);

  const [link] = await db
    .insert(taskExternalLinks)
    .values({
      userId,
      taskId: task.id,
      accountId: account.id,
      provider: account.provider,
      externalId: external.externalId,
      externalUrl: external.url,
      kind: "task",
      role: "source",
      status: "active",
      remoteUpdatedAt: external.remoteUpdatedAt,
      remoteMeta: buildLinkMeta(external),
      lastRefreshedAt: now,
    })
    .returning();

  if (!link) {
    throw new Error("Failed to link imported task");
  }

  return { task, link, alreadyExisted: false };
}

/**
 * Re-pull a linked task's current values from the provider.
 *
 * The user asked for this explicitly, so the remote wins outright on the
 * fields it owns — no fingerprint comparison, no conflict prompt.
 */
export async function refreshLinkedTask(
  userId: string,
  linkId: string
): Promise<{ task: Task; link: TaskExternalLink }> {
  const db = getDb();

  const [link] = await db
    .select()
    .from(taskExternalLinks)
    .where(
      and(
        eq(taskExternalLinks.id, linkId),
        eq(taskExternalLinks.userId, userId)
      )
    )
    .limit(1);

  if (!link) {
    throw new Error("Link not found");
  }
  if (link.role !== "source") {
    throw new Error("Only the source link can refresh a task");
  }
  if (!link.accountId) {
    throw new Error(
      "This link has no connected account — reconnect the integration to refresh it"
    );
  }

  const [account] = await db
    .select()
    .from(integrationAccounts)
    .where(eq(integrationAccounts.id, link.accountId))
    .limit(1);

  if (!account) {
    throw new Error("Integration account not found");
  }

  const [current] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, link.taskId))
    .limit(1);

  if (!current) {
    throw new Error("Task not found");
  }

  const provider = getTaskProvider(account.provider);
  const credentials = JSON.parse(decrypt(account.credentialsEncrypted));
  const now = new Date();

  let external: ExternalTask;
  try {
    external = await provider.fetchTask(credentials, link.externalId);
  } catch (error) {
    if (error instanceof ProviderTaskNotFoundError) {
      // The remote object is gone. The local task is left completely
      // alone — by now it carries the user's own notes, scheduling and
      // tracked time. Only the chip changes.
      const [orphaned] = await db
        .update(taskExternalLinks)
        .set({ status: "orphaned", lastRefreshedAt: now, updatedAt: now })
        .where(eq(taskExternalLinks.id, link.id))
        .returning();

      return { task: current, link: orphaned ?? link };
    }
    throw error;
  }

  const [task] = await db
    .update(tasks)
    .set({
      ...buildImportedTaskPatch(external, current, now),
      updatedAt: now,
    })
    .where(eq(tasks.id, current.id))
    .returning();

  await mergeSubtasks(current.id, external.subtasks);

  const [refreshed] = await db
    .update(taskExternalLinks)
    .set({
      externalUrl: external.url,
      remoteUpdatedAt: external.remoteUpdatedAt,
      remoteMeta: buildLinkMeta(external),
      status: "active",
      lastRefreshedAt: now,
      updatedAt: now,
    })
    .where(eq(taskExternalLinks.id, link.id))
    .returning();

  return { task: task ?? current, link: refreshed ?? link };
}

async function nextBacklogPosition(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ max: sql<number | null>`max(${tasks.position})` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.scheduledDate)));

  return (row?.max ?? -1) + 1;
}

/**
 * Merge the remote checklist into the local subtasks.
 *
 * Matched by title, and additive: subtasks the user added themselves are
 * kept, because a refresh is a request for the provider's data, not a
 * request to discard their own.
 */
async function mergeSubtasks(
  taskId: string,
  externalSubtasks: ExternalSubtask[]
): Promise<void> {
  if (!externalSubtasks.length) return;

  const db = getDb();
  const existing = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId));

  const existingByTitle = new Map(
    existing.map((subtask) => [subtask.title, subtask])
  );

  for (const [index, external] of externalSubtasks.entries()) {
    const title = external.title.slice(0, 500);
    const match = existingByTitle.get(title);

    if (match) {
      if (match.completed !== external.completed) {
        await db
          .update(subtasks)
          .set({ completed: external.completed, updatedAt: new Date() })
          .where(eq(subtasks.id, match.id));
      }
      continue;
    }

    await db.insert(subtasks).values({
      taskId,
      title,
      completed: external.completed,
      position: existing.length + index,
    });
  }
}
