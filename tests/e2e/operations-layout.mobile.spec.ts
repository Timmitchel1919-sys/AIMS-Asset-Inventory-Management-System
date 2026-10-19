import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kcs-auth", "in");
    localStorage.setItem("kcs-role", "administrator");
    localStorage.setItem("kcs-language", "en");
  });
});

test("movement and reporting workspaces reflow without mobile overflow", async ({
  page,
}, testInfo) => {
  for (const route of ["/movements", "/reports"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath(`${route.slice(1)}-mobile.png`),
      fullPage: true,
    });
  }
});
