import { expect, test } from '@playwright/test';

test('search, login and AIMS landing use current supported surfaces', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('kcs-auth')) localStorage.setItem('kcs-auth', 'in'); localStorage.setItem('kcs-role', 'administrator'); localStorage.setItem('kcs-theme', 'kcs-forest-gold'); });
  await page.goto('/dashboard');
  await expect(page.locator('.global-search kbd')).toBeHidden();
  const search = await page.locator('.global-search').boundingBox();
  const bell = await page.locator('.top-notifications').boundingBox();
  expect(search && bell && bell.x - (search.x + search.width)).toBeLessThan(30);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'kcs-azure-intelligence');
  await expect(page.locator('.aims-public-page')).toHaveAttribute('data-theme', 'aimsAzureGlass');
  expect(await page.locator('.aims-glossy-button').first().evaluate(element => getComputedStyle(element).backgroundImage)).toContain('linear-gradient');
  await page.evaluate(() => localStorage.setItem('kcs-auth', 'out'));
  await page.goto('/login');
  await expect(page.locator('.auth-card')).toBeVisible();
  await expect(page.getByLabel(/email address/i)).toBeVisible();
});
