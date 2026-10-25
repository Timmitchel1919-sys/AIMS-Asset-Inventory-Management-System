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

  const after = await profile.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.height ?? 0).toBeGreaterThan(250);
  expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(before?.y ?? 0);
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
