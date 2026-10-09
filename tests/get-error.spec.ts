import { test } from '@playwright/test';
test('get error', async ({ page }) => {
  await page.goto('http://localhost:5173/assets/ast-0001/edit', { waitUntil: 'networkidle' });
  const locator = page.locator('.bg-red-50.text-red-900');
  try {
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    console.log(await locator.textContent());
  } catch (e) {
    console.log("Error element not found. Maybe the page loaded successfully?");
    // Let's print the entire body text just in case.
    console.log(await page.textContent('body'));
  }
});

