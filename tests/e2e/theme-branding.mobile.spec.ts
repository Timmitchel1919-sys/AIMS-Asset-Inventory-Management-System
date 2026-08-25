import { expect, test } from '@playwright/test';

test('Midnight login remains responsive', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('kcs-auth', 'out'); localStorage.setItem('authenticatedThemePreference','aimsMidnight'); });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/login');
  await expect(page.locator('.auth-brand')).toBeHidden();
  await expect(page.locator('.auth-page')).toHaveAttribute('data-auth-theme', 'aimsMidnight');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('.auth-brand')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
