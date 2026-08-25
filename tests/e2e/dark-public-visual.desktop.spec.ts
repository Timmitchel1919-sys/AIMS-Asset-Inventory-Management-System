import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kcs-auth', 'out');
    localStorage.setItem('kcs-language', 'en');
    localStorage.setItem('authenticatedThemePreference', 'aimsMidnight');
  });
});

test('captures the final dark login first viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await expect(page.locator('.login-card')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aims-midnight');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: 'docs/design/aims-midnight-login.png' });
});

test('captures the final dark login mobile first viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.locator('.login-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'docs/design/aims-midnight-login-mobile.png' });
});

test('captures the complete light login first viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 945 });
  await page.addInitScript(() => localStorage.setItem('authenticatedThemePreference', 'aimsAzureGlass'));
  await page.goto('/login');
  await expect(page.locator('.auth-brand')).toBeVisible();
  await expect(page.getByLabel('Choose language')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'kcs-azure-intelligence');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1680);
  await page.screenshot({ path: 'docs/design/aims-light-login.png' });
});
