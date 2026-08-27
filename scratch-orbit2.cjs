const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:5190/', { timeout: 60000 });
  await page.waitForSelector('.aims-orbital-hero');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/orbit-full.png' });
  const box = await page.locator('.aims-orbital-hero').boundingBox();
  const heroVisualBox = await page.locator('.aims-hero-visual').boundingBox();
  console.log('orbital box', box);
  console.log('hero-visual box', heroVisualBox);
  await browser.close();
})();
