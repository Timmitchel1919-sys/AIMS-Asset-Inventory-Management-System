import { expect, test } from '@playwright/test';

test('Azure-branded login remains responsive', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kcs-auth', 'out'));
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/login');
  await expect(page.locator('.auth-brand')).toBeVisible();
  await expect(page.locator('.auth-page')).toHaveAttribute('data-auth-theme', 'aimsAzureGlass');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('.auth-brand')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
