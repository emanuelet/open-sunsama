import { expect, test, type Page } from "@playwright/test";

const API = `http://localhost:${process.env.API_PORT ?? 3201}`;

async function setup(page: Page) {
  const response = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `hierarchy-${Date.now()}-${Math.random().toString(36).slice(2)}-e2e@example.com`,
      password: "E2e-Passw0rd",
      name: "Hierarchy Explorer",
    }),
  });
  expect(response.status).toBe(201);
  const { data: session } = await response.json();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("open_sunsama_token", token);
    localStorage.setItem("open_sunsama_user", JSON.stringify(user));
  }, session);
  const request = async (path: string, data?: unknown) => {
    const result = await fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    expect(result.ok).toBe(true);
    return (await result.json()).data;
  };
  const parent = await request("/goals", { title: "Be a better father" });
  const child = await request("/goals", {
    title: "Be more present",
    parentId: parent.id,
  });
  const leaf = await request("/goals", {
    title: "Make room for conversations",
    parentId: child.id,
  });
  const other = await request("/goals", { title: "Get better at drama" });
  return { request, parent, child, leaf, other };
}

const hierarchySwitch = (page: Page) =>
  page
    .getByRole("button", { name: "Hierarchy", exact: true })
    .or(page.getByRole("tab", { name: "Hierarchy", exact: true }));

test("hierarchy connects goals, collapses branches and opens focused goal details", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { child } = await setup(page);
  await page.goto("/app/goals");
  await expect(
    page.getByRole("link", { name: "Be a better father", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Be more present", exact: true })
  ).toHaveCount(0);
  await hierarchySwitch(page).click();
  await expect(page).toHaveURL(/view=hierarchy/);
  const hierarchy = page.getByRole("region", {
    name: "Goal hierarchy",
    exact: true,
  });
  await expect(hierarchy).toBeVisible();
  await expect(
    hierarchy.getByRole("link", { name: /Be more present/ })
  ).toBeVisible();
  await expect(
    hierarchy.getByRole("link", { name: /Make room for conversations/ })
  ).toBeVisible();
  await hierarchy
    .getByRole("button", { name: "Collapse Be more present", exact: true })
    .click();
  await expect(
    hierarchy.getByRole("link", { name: /Make room for conversations/ })
  ).toHaveCount(0);
  await hierarchy
    .getByRole("button", { name: "Expand Be more present", exact: true })
    .click();
  await expect(
    hierarchy.getByRole("link", { name: /Make room for conversations/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  await expect(
    hierarchy.getByRole("link", { name: /Be more present/ })
  ).toHaveCount(0);
  await expect(
    hierarchy.getByRole("link", { name: /Get better at drama/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand all", exact: true }).click();
  await hierarchy.getByRole("link", { name: /Be more present/ }).click();
  await expect(page).toHaveURL(new RegExp(`goal=${child.id}`));
  await expect(page.getByRole("textbox", { name: "Goal title" })).toHaveValue(
    "Be more present"
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" })
  ).toContainText("Be a better father");
  await page.goBack();
  await expect(
    page.getByRole("region", { name: "Goal hierarchy", exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Goal hierarchy", exact: true })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile and archived hierarchy remain legible and respect archive boundaries", async ({
  page,
}) => {
  const { request, child } = await setup(page);
  await request(`/goals/${child.id}/archive`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/goals?view=hierarchy");
  const hierarchy = page.getByRole("region", {
    name: "Goal hierarchy",
    exact: true,
  });
  await expect(
    hierarchy.getByRole("link", { name: /Be a better father/ })
  ).toBeVisible();
  await expect(
    hierarchy.getByRole("link", { name: /Be more present/ })
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.getByRole("link", { name: "Archived goals", exact: true }).click();
  // Preserve the selected visualization when switching between active/archive.
  await expect(hierarchy).toBeVisible();
  await expect(
    hierarchy.getByRole("link", { name: /Be more present/ })
  ).toBeVisible();
  await expect(
    hierarchy.getByRole("link", { name: /Make room for conversations/ })
  ).toBeVisible();
  await expect(
    hierarchy.getByRole("link", { name: /Be a better father/ })
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await hierarchy
    .getByRole("link", { name: /Make room for conversations/ })
    .click();
  await expect(page.getByRole("textbox", { name: "Goal title" })).toHaveValue(
    "Make room for conversations"
  );
  await expect(
    page.getByRole("textbox", { name: "Goal title" })
  ).toHaveAttribute("readonly", "");
});
