import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getDb,
  goals,
  tasks,
  eq,
  and,
  asc,
  isNull,
  isNotNull,
  inArray,
  sql,
} from "@open-sunsama/database";
import {
  NotFoundError,
  ValidationError,
  uuidSchema,
} from "@open-sunsama/utils";
import { auth, requireScopes, type AuthVariables } from "../middleware/auth.js";
import { publishEvent } from "../lib/websocket/index.js";

const goalsRouter = new Hono<{ Variables: AuthVariables }>();
goalsRouter.use("*", auth);
const read = requireScopes("tasks:read");
const write = requireScopes("tasks:write");
const param = z.object({ id: uuidSchema });
const create = z.object({
  title: z.string().trim().min(1).max(500),
  parentId: uuidSchema.nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});
const update = create
  .partial()
  .extend({ reflection: z.string().max(5000).nullable().optional() });
type GoalRow = typeof goals.$inferSelect;
const publicGoal = ({ archiveBatchId: _batch, ...goal }: GoalRow) => goal;
function owned(rows: GoalRow[], id: string) {
  const goal = rows.find((row) => row.id === id);
  if (!goal) throw new NotFoundError("Goal", id);
  return goal;
}
function activeParent(rows: GoalRow[], id: string | null | undefined) {
  if (!id) return;
  const parent = owned(rows, id);
  if (parent.archivedAt) throw new ValidationError("Parent goal is archived");
}

// Serialize tree mutations per user so concurrent moves cannot form cycles and
// archive/restore operations see a consistent subtree.
async function mutate<T>(
  userId: string,
  fn: (
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    rows: GoalRow[]
  ) => Promise<T>
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 93741))`
    );
    const rows = await tx.select().from(goals).where(eq(goals.userId, userId));
    return fn(tx, rows);
  });
}

goalsRouter.get(
  "/",
  read,
  zValidator(
    "query",
    z.object({ archived: z.enum(["true", "false"]).optional() })
  ),
  async (c) => {
    const rows = await getDb()
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, c.get("userId")),
          c.req.valid("query").archived === "true"
            ? isNotNull(goals.archivedAt)
            : isNull(goals.archivedAt)
        )
      )
      .orderBy(asc(goals.position), asc(goals.createdAt));
    return c.json({ success: true, data: rows.map(publicGoal) });
  }
);

goalsRouter.post("/", write, zValidator("json", create), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");
  const goal = await mutate(userId, async (tx, rows) => {
    activeParent(rows, data.parentId);
    const siblings = rows.filter(
      (g) => !g.archivedAt && g.parentId === (data.parentId ?? null)
    );
    const position = Math.max(-1, ...siblings.map((g) => g.position)) + 1;
    const [result] = await tx
      .insert(goals)
      .values({
        userId,
        title: data.title,
        parentId: data.parentId ?? null,
        description: data.description ?? null,
        position,
      })
      .returning();
    return result!;
  });
  publishEvent(userId, "goal:created", { goalId: goal.id });
  return c.json({ success: true, data: publicGoal(goal) }, 201);
});

goalsRouter.post(
  "/reorder",
  write,
  zValidator(
    "json",
    z.object({ parentId: uuidSchema.nullable(), goalIds: z.array(uuidSchema) })
  ),
  async (c) => {
    const userId = c.get("userId");
    const { parentId, goalIds } = c.req.valid("json");
    const result = await mutate(userId, async (tx, rows) => {
      activeParent(rows, parentId);
      const siblings = rows.filter(
        (g) => !g.archivedAt && g.parentId === parentId
      );
      if (
        new Set(goalIds).size !== goalIds.length ||
        siblings.length !== goalIds.length ||
        siblings.some((g) => !goalIds.includes(g.id))
      )
        throw new ValidationError("Supply every sibling goal ID exactly once");
      const result: GoalRow[] = [];
      for (const [position, id] of goalIds.entries()) {
        const [goal] = await tx
          .update(goals)
          .set({ position, updatedAt: new Date() })
          .where(and(eq(goals.id, id), eq(goals.userId, userId)))
          .returning();
        result.push(goal!);
      }
      return result;
    });
    publishEvent(userId, "goal:reordered", { parentId, goalIds });
    return c.json({ success: true, data: result.map(publicGoal) });
  }
);

goalsRouter.get("/:id/tasks", read, zValidator("param", param), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.valid("param");
  const db = getDb();
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);
  if (!goal) throw new NotFoundError("Goal", id);
  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.goalId, id)))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  return c.json({ success: true, data: result });
});

goalsRouter.get("/:id", read, zValidator("param", param), async (c) => {
  const { id } = c.req.valid("param");
  const [goal] = await getDb()
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, c.get("userId"))))
    .limit(1);
  if (!goal) throw new NotFoundError("Goal", id);
  return c.json({ success: true, data: publicGoal(goal) });
});

goalsRouter.patch(
  "/:id",
  write,
  zValidator("param", param),
  zValidator("json", update),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const goal = await mutate(userId, async (tx, rows) => {
      const existing = owned(rows, id);
      if (existing.archivedAt) throw new ValidationError("Goal is archived");
      if (data.parentId !== undefined && data.parentId !== existing.parentId) {
        activeParent(rows, data.parentId);
        let parentId = data.parentId;
        while (parentId) {
          if (parentId === id)
            throw new ValidationError(
              "Cannot move a goal into its own subtree"
            );
          parentId = owned(rows, parentId).parentId;
        }
        const siblings = rows.filter(
          (g) => !g.archivedAt && g.parentId === data.parentId
        );
        const [result] = await tx
          .update(goals)
          .set({
            ...data,
            position: Math.max(-1, ...siblings.map((g) => g.position)) + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(goals.id, id), eq(goals.userId, userId)))
          .returning();
        return result!;
      }
      const [result] = await tx
        .update(goals)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .returning();
      return result!;
    });
    publishEvent(userId, "goal:updated", { goalId: id });
    return c.json({ success: true, data: publicGoal(goal) });
  }
);

for (const action of ["archive", "restore"] as const) {
  goalsRouter.post(
    `/:id/${action}`,
    write,
    zValidator("param", param),
    async (c) => {
      const userId = c.get("userId");
      const { id } = c.req.valid("param");
      const goal = await mutate(userId, async (tx, rows) => {
        const root = owned(rows, id);
        if (
          (action === "archive" && root.archivedAt) ||
          (action === "restore" && !root.archivedAt)
        )
          return root;
        if (action === "restore") activeParent(rows, root.parentId);
        const ids = new Set([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const row of rows) {
            if (
              row.parentId &&
              ids.has(row.parentId) &&
              !ids.has(row.id) &&
              (action === "archive"
                ? !row.archivedAt
                : row.archiveBatchId === root.archiveBatchId)
            ) {
              ids.add(row.id);
              changed = true;
            }
          }
        }
        const now = new Date();
        const updated = await tx
          .update(goals)
          .set(
            action === "archive"
              ? {
                  archivedAt: now,
                  archiveBatchId: randomUUID(),
                  updatedAt: now,
                }
              : { archivedAt: null, archiveBatchId: null, updatedAt: now }
          )
          .where(and(eq(goals.userId, userId), inArray(goals.id, [...ids])))
          .returning();
        return updated.find((g) => g.id === id)!;
      });
      publishEvent(
        userId,
        action === "archive" ? "goal:archived" : "goal:restored",
        { goalId: id }
      );
      return c.json({ success: true, data: publicGoal(goal) });
    }
  );
}

export { goalsRouter };
