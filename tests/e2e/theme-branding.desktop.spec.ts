import { expect, test } from '@playwright/test';

test('public authentication uses Azure branding and the signed-in sidebar renders', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('kcs-auth', 'out'); localStorage.setItem('kcs-theme', 'kcs-forest-gold'); });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'kcs-azure-intelligence');
  await expect(page.locator('.auth-brand')).toBeVisible();
  await expect(page.locator('.auth-page')).toHaveAttribute('data-auth-theme', 'aimsEmeraldGloss');
  await page.getByLabel(/email address/i).fill('verified.e2e@kangoeroeschool.com');
  await page.getByLabel('Password', { exact: true }).fill('presentation-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.app-sidebar')).toBeVisible();
});
