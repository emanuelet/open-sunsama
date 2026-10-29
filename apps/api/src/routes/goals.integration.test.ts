import { describe, expect, it } from "vitest";

// Opt in against an already migrated disposable development stack.
const base = process.env.GOALS_TEST_API_URL;
const suite =
  base && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)
    ? describe
    : describe.skip;

suite("goals API with PostgreSQL", () => {
  it("enforces ownership, tree invariants, task links, ordering and archive batches", async () => {
    async function call(
      method: string,
      path: string,
      body?: unknown,
      token?: string
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        json: (await response.json()) as { data: any },
      };
    }
    const nonce = crypto.randomUUID();
    async function register(suffix: string) {
      const result = await call("POST", "/auth/register", {
        email: `goals-${nonce}-${suffix}@example.com`,
        password: "TestPassword123!",
        name: "Goals test",
      });
      expect(result.status).toBe(201);
      return result.json.data.token as string;
    }
    const owner = await register("one");
    const other = await register("two");
    async function create(title: string, parentId?: string) {
      const result = await call("POST", "/goals", { title, parentId }, owner);
      expect(result.status).toBe(201);
      return result.json.data.id as string;
    }
    const root = await create("Root");
    const child = await create("Child", root);
    const independent = await create("Independent", root);
    const grandchild = await create("Grandchild", child);
    expect((await call("GET", `/goals/${root}`, undefined, other)).status).toBe(
      404
    );
    expect(
      (
        await call(
          "POST",
          "/goals",
          { title: "Foreign", parentId: root },
          other
        )
      ).status
    ).toBe(404);
    expect(
      (await call("POST", "/tasks", { title: "Foreign", goalId: root }, other))
        .status
    ).toBe(404);
    const foreignTask = await call(
      "POST",
      "/tasks",
      { title: "Other task" },
      other
    );
    expect(foreignTask.status).toBe(201);
    expect(
      (
        await call(
          "PATCH",
          `/tasks/${foreignTask.json.data.id}`,
          { goalId: root },
          other
        )
      ).status
    ).toBe(404);
    const ownTask = await call(
      "POST",
      "/tasks",
      { title: "Direct", goalId: root },
      owner
    );
    const childTask = await call(
      "POST",
      "/tasks",
      { title: "Child task", goalId: child },
      owner
    );
    expect(ownTask.status).toBe(201);
    expect(childTask.status).toBe(201);
    expect(
      (
        await call("GET", `/goals/${root}/tasks`, undefined, owner)
      ).json.data.map((t: { id: string }) => t.id)
    ).toEqual([ownTask.json.data.id]);
    expect(
      (
        await call(
          "PATCH",
          `/tasks/${ownTask.json.data.id}`,
          { goalId: grandchild },
          other
        )
      ).status
    ).toBe(404);
    expect(
      (await call("PATCH", `/goals/${root}`, { parentId: grandchild }, owner))
        .status
    ).toBe(400);
    expect(
      (
        await call(
          "POST",
          "/goals/reorder",
          { parentId: root, goalIds: [independent, child] },
          owner
        )
      ).json.data.map((g: { id: string }) => g.id)
    ).toEqual([independent, child]);
    expect(
      (
        await call(
          "POST",
          "/goals/reorder",
          { parentId: root, goalIds: [child, child] },
          owner
        )
      ).status
    ).toBe(400);
    expect(
      (await call("POST", `/goals/${independent}/archive`, {}, owner)).status
    ).toBe(200);
    expect(
      (await call("POST", `/goals/${root}/archive`, {}, owner)).status
    ).toBe(200);
    expect(
      (await call("POST", `/goals/${root}/restore`, {}, owner)).status
    ).toBe(200);
    const archived = (
      await call("GET", "/goals?archived=true", undefined, owner)
    ).json.data;
    expect(archived.map((g: { id: string }) => g.id)).toEqual([independent]);
    expect(
      (await call("GET", `/goals/${root}/tasks`, undefined, owner)).json.data[0]
        .id
    ).toBe(ownTask.json.data.id);
    const a = await create("Concurrent A");
    const b = await create("Concurrent B");
    const attempts = await Promise.all([
      call("PATCH", `/goals/${a}`, { parentId: b }, owner),
      call("PATCH", `/goals/${b}`, { parentId: a }, owner),
    ]);
    expect(attempts.map((r) => r.status).sort()).toEqual([200, 400]);
  }, 30000);
});
