import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 720 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const theme of ['aimsAzureGlass', 'aimsMidnight', 'aimsEmeraldGloss'] as const) {
  test(`shared wordmark remains responsive in ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(selected => {
      localStorage.setItem('kcs-auth', 'out');
      localStorage.setItem('kcs-language', 'nl');
      localStorage.setItem('authenticatedThemePreference', selected);
    }, theme);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('.aims-brand .brand-wordmark')).toBeVisible();
      await expect(page.locator('.aims-brand .brand-wordmark__a circle')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.goto('/login');
      await expect(page.locator('.login-card .brand-wordmark--auth')).toHaveCount(0);
      await expect(page.locator('.login-card img')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/signup');
    await expect(page.locator('.login-card .brand-wordmark--auth')).toHaveCount(0);
    await expect(page.locator('.login-card img')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await expect(page.locator('.login-card .brand-wordmark--auth')).toHaveCount(0);
    await page.screenshot({ path: `docs/design/wordmark-${theme}-login.png` });
    await page.goto('/signup');
    await expect(page.locator('.login-card .brand-wordmark--auth')).toHaveCount(0);
    await page.screenshot({ path: `docs/design/wordmark-${theme}-signup.png` });
    expect(errors).toEqual([]);
  });
}
