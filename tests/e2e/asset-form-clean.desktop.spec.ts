import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "en");
    localStorage.setItem(
      "aims-draft:asset-form:new",
      JSON.stringify({ value: { name: "Stale edited asset", serialNumber: "OLD-1" }, savedAt: new Date().toISOString() }),
    );
  });
});

test("a new asset panel ignores and clears values from the previous add flow", async ({ page }) => {
  await page.goto("/assets/new");
  await expect(page.getByLabel(/asset name/i)).toHaveValue("");
  await expect(page.getByLabel(/serial number/i)).toHaveValue("");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("aims-draft:asset-form:new"))).toBeNull();
});
