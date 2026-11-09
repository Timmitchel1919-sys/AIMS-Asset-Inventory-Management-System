import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "nl");
  });
});

for (const [route, action] of [
  ["/categories", /Nieuw assettype/i],
  ["/departments", /Afdeling toevoegen/i],
  ["/assignments", /Middel toewijzen/i],
] as const) {
  test(`${route} keeps its primary action at the right edge of the data toolbar`, async ({ page }) => {
    await page.goto(route);
    const toolbar = page.locator("main .data-toolbar").first();
    const button = toolbar.getByRole("button", { name: action });
    await expect(button).toBeVisible();
    const toolbarBox = await toolbar.boundingBox();
    const buttonBox = await button.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect((toolbarBox!.x + toolbarBox!.width) - (buttonBox!.x + buttonBox!.width)).toBeLessThanOrEqual(28);
  });
}

test("inventory movements uses the requested column order and one aligned toolbar", async ({ page }) => {
  await page.goto("/movements");
  const toolbar = page.locator("main .movement-workspace-card .data-toolbar");
  await expect(toolbar.getByRole("button", { name: /Mutatie registreren/i })).toBeVisible();
  const headers = await page.locator('[data-testid="table-movements"] thead th').evaluateAll((cells) =>
    cells.map((cell) => cell.textContent?.replace(/[↑↓]$/u, "").trim()).filter(Boolean),
  );
  expect(headers).toEqual([
    "Inv.code",
    "Middel / artikel",
    "Aantal",
    "Type",
    "Referentie",
    "Bron → bestemming",
    "Datum en tijd",
    "Uitgevoerd door",
  ]);
});

test("other data modules align their existing primary action with the toolbar", async ({ page }) => {
  await page.goto("/repairs");
  const toolbar = page.locator("main .data-toolbar").first();
  const action = page.getByRole("button", { name: /Reparatie melden/i });
  await expect(action).toBeVisible();
  const toolbarBox = await toolbar.boundingBox();
  const actionBox = await action.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(actionBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y);
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(toolbarBox!.y + toolbarBox!.height);
});
