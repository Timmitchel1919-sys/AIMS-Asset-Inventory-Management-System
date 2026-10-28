import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "en");
  });
});

test("sidebar profile opens the complete account panel without moving", async ({ page }) => {
  await page.goto("/dashboard");

  const profile = page.getByRole("button", { name: "Open account menu" });
  await expect(profile).not.toContainText("Administrator");
  await expect(profile).toContainText(/Verified/i);
  await expect(profile).not.toContainText(/Owner/i);
  const before = await profile.boundingBox();
  expect(before).not.toBeNull();

  await profile.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(profile).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await expect(menu.getByRole("menuitem", { name: /My Profile/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Preferences/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Security/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Help & Support/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Sign out/i })).toBeVisible();
  await expect(page.locator(".account-sheet-scrim")).toHaveCSS("z-index", "59");
  await expect(page.locator(".app-sidebar")).toHaveCSS("z-index", "60");
  await expect(page.locator(".authenticated-app main .page-title")).toHaveCSS("z-index", "35");
  expect(await page.locator(".account-sheet-scrim").evaluate((element) =>
    getComputedStyle(element).backdropFilter,
  )).not.toBe("none");

  const after = await profile.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.height ?? 0).toBeGreaterThan(200);
  expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(before?.y ?? 0);
});

test("profile scrim dims sticky ICT headers in light and dark themes", async ({ page }) => {
  for (const theme of ["aims-light", "dark"]) {
    await page.goto("/assets");
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      localStorage.setItem("kcs-theme", value);
    }, theme);
    await page.getByRole("button", { name: "Open account menu" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.locator(".account-sheet-scrim")).toHaveCSS("z-index", "59");
    await expect(page.locator(".app-sidebar")).toHaveCSS("z-index", "60");
    await expect(page.locator(".authenticated-app main .page-title")).toHaveCSS("z-index", "35");
    await page.keyboard.press("Escape");
  }
});

test("collapsed sidebar keeps the complete account panel usable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kcs-sidebar-collapsed", "true"));
  await page.goto("/dashboard");

  const profile = page.getByRole("button", { name: "Open account menu" });
  const before = await profile.boundingBox();
  await profile.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await expect(menu.getByRole("menuitem", { name: /My Profile/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Preferences/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Security/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Help & Support/i })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Sign out/i })).toBeVisible();

  const after = await profile.boundingBox();
  expect(after).toEqual(before);
});
