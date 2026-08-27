import { expect, test } from '@playwright/test';

for (const [name, theme, cssTheme] of [
  ['light', 'aimsAzureGlass', 'kcs-azure-intelligence'],
  ['dark', 'aimsMidnight', 'aims-midnight'],
] as const) {
  test(`reference landing first viewport in ${name} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1680, height: 945 });
    await page.addInitScript(({ selectedTheme }) => {
      localStorage.setItem('kcs-auth', 'out');
      localStorage.setItem('kcs-language', 'nl');
      localStorage.setItem('authenticatedThemePreference', selectedTheme);
    }, { selectedTheme: theme });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', cssTheme);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Beheer elk middel');
    await expect(page.locator('.aims-orbital-hero')).toBeVisible();
    await expect(page.locator('.aims-orbital-chip')).toHaveCount(3);
    await expect(page.locator('.aims-showcase-section .aims-device-stage')).toBeVisible();
    await expect(page.locator('.aims-feature-grid article')).toHaveCount(8);
    await expect(page.locator('.aims-hero-trust li')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1680);
    await page.screenshot({ path: `docs/design/aims-${name}-landing.png` });
    if (name === 'light') await page.screenshot({ path: 'docs/design/aims-light-landing-full.png', fullPage: true });
  });
}
