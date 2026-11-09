import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "en");
  });
});

test("ICT assets uses the topbar title and global search with one unified toolbar", async ({ page }) => {
  await page.goto("/assets");

  await expect(page.locator(".app-topbar").getByRole("heading", { name: "ICT Assets" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Global search" })).toBeVisible();
  await expect(page.locator("main .page-title h1")).toBeHidden();
  await expect(page.locator("main .data-toolbar .search")).toHaveCount(0);
  await expect(page.locator(".topbar-notifications")).toBeVisible();
  await expect(page.locator('.app-sidebar [data-module-id="notifications"]')).toBeHidden();
  expect(await page.locator(".topbar-module__name").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(40);
  await expect(page.locator(".topbar-search .global-search__input-wrapper")).toHaveCSS("border-top-width", "2px");

  const toolbar = page.locator("main .data-toolbar");
  const controls = ["Filters", "Views", "Columns", "Export", "Scan", "Import", "Add asset"].map(
    (name) => toolbar.getByText(name, { exact: true }),
  );
  for (const control of controls) {
    await expect(control).toBeVisible();
  }
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  const tops = boxes.map((box) => Math.round(box?.y ?? -1));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  expect(await toolbar.getByText("Add asset", { exact: true }).evaluate((element) => getComputedStyle(element.closest("button")!).boxShadow)).not.toBe("none");

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.locator(".app-topbar").getByRole("heading", { name: "ICT Assets" })).toBeVisible();
  await expect(toolbar.getByText("Add asset", { exact: true })).toBeVisible();
});

test("warehouse actions follow export in the shared toolbar", async ({ page }) => {
  await page.goto("/inventory");

  await expect(page.locator(".app-topbar").getByRole("heading", { name: "Warehouse" })).toBeVisible();
  await expect(page.locator("main .page-title h1")).toBeHidden();
  await expect(page.locator("main .data-toolbar .search")).toHaveCount(0);

  const summaryNumberSize = await page.locator(".inventory-status-summary .card b").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const summaryLabelSize = await page.locator(".inventory-status-summary .card small").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(summaryNumberSize).toBeGreaterThanOrEqual(40);
  expect(summaryLabelSize).toBeGreaterThanOrEqual(20);
  await expect(page.locator('[data-testid="table-wave3-inventory"] tbody tr').first().locator('td').nth(1)).not.toContainText(/^INV-/);

  const exportButton = page.getByRole("button", { name: "Export" });
  const importLink = page.getByRole("link", { name: "Import" });
  const bulkButton = page.getByRole("button", { name: "Add items in bulk" });
  const addLink = page.getByRole("link", { name: "Add item" });
  for (const control of [exportButton, importLink, bulkButton, addLink]) {
    await expect(control).toBeVisible();
  }
  const positions = await Promise.all(
    [exportButton, importLink, bulkButton, addLink].map(async (control) => (await control.boundingBox())?.x ?? -1),
  );
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});
