import { expect, test } from "@playwright/test";

const API = `http://localhost:${process.env.API_PORT ?? 3201}`;

test("ongoing goals connect daily work without requiring a full hierarchy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const registration = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `goals-${Date.now()}-${Math.random().toString(36).slice(2)}-e2e@example.com`,
      password: "E2e-Passw0rd",
      name: "Goals Explorer",
    }),
  });
  expect(registration.status).toBe(201);
  const { data: session } = await registration.json();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("open_sunsama_token", token);
    localStorage.setItem("open_sunsama_user", JSON.stringify(user));
  }, session);

  await page.goto("/app/goals");
  await page
    .getByRole("textbox", { name: "New goal", exact: true })
    .fill("Be a better father");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("link", { name: "Be a better father", exact: true })
    .click();
  const rootUrl = page.url();
  const rootId = new URL(rootUrl).searchParams.get("goal");
  expect(rootId).toBeTruthy();

  await page
    .getByRole("textbox", { name: "New supporting goal" })
    .fill("Be more present");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("link", { name: "Be more present", exact: true })
    .click();
  const childId = new URL(page.url()).searchParams.get("goal");
  await page
    .getByRole("textbox", { name: "Current reflection" })
    .fill("Bedtime is a good opportunity to talk.");
  const savedReflection = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/goals/${childId}`)
  );
  await page.getByRole("heading", { name: "Connected tasks" }).click();
  expect((await savedReflection).ok()).toBe(true);

  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const composer = page.getByRole("dialog");
  await composer
    .getByRole("textbox", { name: "Task title" })
    .fill("Plan a Saturday outing");
  const taskSaved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/tasks\/?$/.test(response.url())
  );
  await composer.getByRole("button", { name: "Add task", exact: true }).click();
  expect((await taskSaved).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: /Plan a Saturday outing/ })
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Current reflection" })
  ).toHaveValue("Bedtime is a good opportunity to talk.");
  await expect(
    page.getByRole("button", { name: /Plan a Saturday outing/ })
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Be a better father" })
    .click();
  await expect(
    page.getByRole("link", { name: "Be more present", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Plan a Saturday outing/ })
  ).toHaveCount(0);

  // Existing tasks can link directly to a broad intention; no child is needed.
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };
  const taskResponse = await fetch(`${API}/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Ask about the school play" }),
  });
  expect(taskResponse.status).toBe(201);
  await page.getByRole("button", { name: "Link existing task" }).click();
  await page
    .getByRole("textbox", { name: "Search tasks" })
    .fill("Ask about the school play");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ask about the school play", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Ask about the school play/ })
  ).toBeVisible();

  // Archive keeps both direct and descendant tasks intact, including their links.
  const archived = await fetch(`${API}/goals/${rootId}/archive`, {
    method: "POST",
    headers,
  });
  expect(archived.ok).toBe(true);
  await page.goto("/app/goals?archived=true");
  await page
    .getByRole("link", { name: "Be a better father", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Be more present", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ask about the school play/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Goal actions" }).click();
  const restored = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/goals/${rootId}/restore`)
  );
  await page.getByRole("menuitem", { name: "Restore goal" }).click();
  expect((await restored).ok()).toBe(true);
  await page.goto(rootUrl);
  await expect(
    page.getByRole("link", { name: "Be more present", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ask about the school play/ })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("task context and moving goals preserve their connections", async ({
  page,
}) => {
  const registration = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `goals-move-${Date.now()}-e2e@example.com`,
      password: "E2e-Passw0rd",
      name: "Goals Explorer",
    }),
  });
  expect(registration.status).toBe(201);
  const { data: session } = await registration.json();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };
  async function create(path: string, body: unknown) {
    const response = await fetch(`${API}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    return (await response.json()).data;
  }
  const drama = await create("/goals", { title: "Get better at drama" });
  const voice = await create("/goals", {
    title: "Develop my voice",
    parentId: drama.id,
  });
  const confidence = await create("/goals", { title: "Build confidence" });
  const task = await create("/tasks", {
    title: "Practice a monologue",
    goalId: voice.id,
  });
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("open_sunsama_token", token);
    localStorage.setItem("open_sunsama_user", JSON.stringify(user));
  }, session);
  await page.goto(`/app/goals?goal=${voice.id}`);
  await page.getByRole("button", { name: /Practice a monologue/ }).click();
  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("button", { name: /Get better at drama.*Develop my voice/ })
  ).toBeVisible();
  await modal
    .getByRole("button", { name: /Get better at drama.*Develop my voice/ })
    .click();
  await page
    .getByRole("textbox", { name: "Search goals" })
    .fill("Build confidence");
  const linked = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/tasks/${task.id}`)
  );
  await page
    .getByRole("button", { name: "Build confidence", exact: true })
    .click();
  expect((await linked).ok()).toBe(true);
  await modal.getByRole("link", { name: "Open goal" }).click();
  await expect(page).toHaveURL(new RegExp(`goal=${confidence.id}`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Practice a monologue/ })
  ).toBeVisible();

  // Move the goal through the UI; its task remains attached and breadcrumb updates.
  await page.getByRole("button", { name: "Goal actions" }).click();
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search destination goals" })
    .fill("Get better at drama");
  const moved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/goals/${confidence.id}`)
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Get better at drama", exact: true })
    .click();
  expect((await moved).ok()).toBe(true);
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Get better at drama" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Practice a monologue/ })
  ).toBeVisible();

  await page.getByRole("button", { name: "Goal actions" }).click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Connected tasks and their links are kept"
  );
  const archived = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/goals/${confidence.id}/archive`)
  );
  await page.getByRole("button", { name: "Archive goal", exact: true }).click();
  expect((await archived).ok()).toBe(true);
  await page.goto(`/app/goals?goal=${confidence.id}`);
  await expect(
    page.getByRole("button", { name: /Practice a monologue/ })
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Goal title" })
  ).toHaveAttribute("readonly", "");
});
