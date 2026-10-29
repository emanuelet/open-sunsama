import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";
import { errorHandler } from "../middleware/error.js";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), publishEvent: vi.fn() }));
vi.mock("@open-sunsama/database", async (original) => ({
  ...(await original<object>()),
  getDb: mocks.getDb,
}));
vi.mock("../lib/websocket/index.js", () => ({
  publishEvent: mocks.publishEvent,
}));
import { goalsRouter } from "./goals.js";
import { tasksRouter } from "./tasks.js";

const user = "b1593d7c-102c-49df-8fa8-5e5fc70abe03";
const root = "10000000-0000-4000-8000-000000000001";
const child = "10000000-0000-4000-8000-000000000002";
const old = "10000000-0000-4000-8000-000000000003";
const batch = "10000000-0000-4000-8000-000000000004";
const goal = (
  id: string,
  parentId: string | null,
  archivedAt: Date | null = null,
  archiveBatchId: string | null = null
) => ({
  id,
  userId: user,
  parentId,
  title: "Goal",
  description: null,
  reflection: null,
  position: 0,
  archivedAt,
  archiveBatchId,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const app = new Hono().route("/goals", goalsRouter).onError(errorHandler);
const taskApp = new Hono().route("/tasks", tasksRouter).onError(errorHandler);
let rows: ReturnType<typeof goal>[];
let predicate: SQL | undefined;
let changes: Record<string, unknown> | undefined;
beforeEach(() => {
  rows = [];
  predicate = undefined;
  changes = undefined;
  const tx = {
    execute: async () => [],
    select: () => ({ from: () => ({ where: async () => rows }) }),
    update: () => ({
      set: (data: Record<string, unknown>) => {
        changes = data;
        return {
          where: (where: SQL) => {
            predicate = where;
            return {
              returning: async () => rows.map((r) => ({ ...r, ...data })),
            };
          },
        };
      },
    }),
  };
  mocks.getDb.mockReturnValue({
    transaction: (fn: (tx: unknown) => unknown) => fn(tx),
  });
});
function request(path: string, method: string, body?: object) {
  return app.request(`/goals${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${signToken(user)}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
describe("goal tree mutations", () => {
  it("rejects moves into descendants and inaccessible parents", async () => {
    rows = [goal(root, null), goal(child, root)];
    expect(
      (await request(`/${root}`, "PATCH", { parentId: child })).status
    ).toBe(400);
    expect((await request(`/${root}`, "PATCH", { parentId: old })).status).toBe(
      404
    );
    expect(changes).toBeUndefined();
  });
  it("archives only active descendants, preserving earlier archive batches", async () => {
    rows = [
      goal(root, null),
      goal(child, root),
      goal(old, child, new Date(), batch),
    ];
    expect((await request(`/${root}/archive`, "POST")).status).toBe(200);
    const query = new PgDialect().sqlToQuery(predicate!);
    expect(query.params).toEqual(expect.arrayContaining([user, root, child]));
    expect(query.params).not.toContain(old);
    expect(changes?.archiveBatchId).toBeTruthy();
  });
  it("restores only the matching batch and refuses an archived parent", async () => {
    rows = [
      goal(root, null, new Date(), batch),
      goal(child, root, new Date(), batch),
      goal(old, child, new Date(), old),
    ];
    expect((await request(`/${child}/restore`, "POST")).status).toBe(400);
    expect((await request(`/${root}/restore`, "POST")).status).toBe(200);
    const query = new PgDialect().sqlToQuery(predicate!);
    expect(query.params).toEqual(expect.arrayContaining([user, root, child]));
    expect(query.params).not.toContain(old);
    expect(changes?.archiveBatchId).toBeNull();
  });
  it("rejects duplicate and foreign reorder IDs", async () => {
    rows = [goal(root, null), goal(child, null)];
    expect(
      (
        await request("/reorder", "POST", {
          parentId: null,
          goalIds: [root, root],
        })
      ).status
    ).toBe(400);
    expect(
      (
        await request("/reorder", "POST", {
          parentId: null,
          goalIds: [root, old],
        })
      ).status
    ).toBe(400);
  });
});

describe("task goal links", () => {
  it("rejects a goal not owned by the caller before creating a task", async () => {
    let where: SQL | undefined;
    const insert = vi.fn();
    mocks.getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: (condition: SQL) => {
            where = condition;
            return { limit: async () => [] };
          },
        }),
      }),
      insert,
    });
    const response = await taskApp.request("/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${signToken(user)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Task", goalId: root }),
    });
    expect(response.status).toBe(404);
    const query = new PgDialect().sqlToQuery(where!);
    expect(query.params).toEqual(expect.arrayContaining([user, root]));
    expect(query.sql).toContain('"archived_at" is null');
    expect(insert).not.toHaveBeenCalled();
  });
});
