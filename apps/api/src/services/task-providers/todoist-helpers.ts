/** Todoist API v1 response shapes and provider-neutral normalizers. */
import { z } from "zod";
import type { TaskPriority } from "@open-sunsama/database";
import type { ExternalTask } from "./index";

export const todoistCredentialSchema = z.object({
  token: z.string().min(10, "Token looks too short"),
});

export type TodoistCredentials = z.infer<typeof todoistCredentialSchema>;

export interface TodoistUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

export interface TodoistProject {
  id: string;
  name: string;
}

export interface TodoistTask {
  id: string;
  project_id: string;
  content: string;
  description: string;
  priority: number;
  checked: boolean;
  completed_at: string | null;
  updated_at: string;
  due: { date: string } | null;
  duration: { amount: number; unit: "minute" | "day" } | null;
}

/** Todoist numbers priority from one (lowest) through four (highest). */
export function mapPriority(priority: number): TaskPriority | null {
  switch (priority) {
    case 4:
      return "P0";
    case 3:
      return "P1";
    case 2:
      return "P2";
    case 1:
      return "P3";
    default:
      return null;
  }
}

export function mapEstimateMins(
  duration: TodoistTask["duration"]
): number | null {
  return duration?.unit === "minute" && duration.amount > 0
    ? duration.amount
    : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeTask(
  raw: TodoistTask,
  project: TodoistProject | null
): ExternalTask {
  return {
    externalId: raw.id,
    title: raw.content,
    description: raw.description || null,
    priority: mapPriority(raw.priority),
    estimatedMins: mapEstimateMins(raw.duration),
    isCompleted: raw.checked || raw.completed_at !== null,
    statusName: raw.checked || raw.completed_at !== null ? "completed" : "open",
    dueDate: parseDate(raw.due?.date),
    url: `https://app.todoist.com/app/task/${encodeURIComponent(raw.id)}`,
    containerName: project?.name ?? null,
    remoteUpdatedAt: parseDate(raw.updated_at) ?? new Date(0),
    // The single-task endpoint does not include children. A future provider
    // extension can add them without changing the import contract.
    subtasks: [],
  };
}

function isTodoistTaskId(id: string): boolean {
  return /^[A-Za-z0-9]{6,255}$/.test(id);
}

/** Recognize canonical Todoist task URLs and bare server task ids. */
export function parseTodoistReference(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    if (!/(^|\.)todoist\.com$/i.test(url.hostname)) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    const taskIndex = segments.indexOf("task");
    const candidate = taskIndex === -1 ? undefined : segments[taskIndex + 1];
    return candidate && isTodoistTaskId(candidate) ? candidate : null;
  }

  return isTodoistTaskId(trimmed) ? trimmed : null;
}
