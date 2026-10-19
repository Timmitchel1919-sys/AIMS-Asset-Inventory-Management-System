import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "en");
  });
});

test("movement and reporting workspaces stay compact on desktop", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/movements");
  await expect(
    page.getByRole("heading", { name: "Inventory movements" }),
  ).toBeVisible();
  const filters = page.locator(".movement-filters");
  await expect(filters).toBeVisible();
  const filterBoxes = await filters
    .locator("label")
    .evaluateAll((labels) =>
      labels.map((label) => label.getBoundingClientRect()),
    );
  expect(filterBoxes).toHaveLength(4);
  expect(
    Math.max(...filterBoxes.map((box) => box.top)) -
      Math.min(...filterBoxes.map((box) => box.top)),
  ).toBeLessThan(3);
  await page.getByPlaceholder("Search movements…").fill("KB-");
  await expect(page.locator(".filter-chips")).toContainText("KB-");
  await page.screenshot({
    path: testInfo.outputPath("movements-desktop.png"),
    fullPage: true,
  });

  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Reporting & Export Center" }),
  ).toBeVisible();
  await expect(page.locator(".reports-control-card")).toBeVisible();
  const filterTops = await page
    .locator(".reports-filter-grid > div")
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().top),
    );
  expect(Math.max(...filterTops) - Math.min(...filterTops)).toBeLessThan(3);
  await expect(page.locator(".reports-results-card")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("reports-desktop.png"),
    fullPage: true,
  });

  expect(
    await page.locator("[data-vite-dev-id], vite-error-overlay").count(),
  ).toBe(0);
  expect(consoleErrors).toEqual([]);
});
