const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  for (const w of [390, 768]) {
    const page = await browser.newPage({ viewport: { width: w, height: 1400 } });
    await page.addInitScript(() => localStorage.setItem('kcs-auth', 'out'));
    await page.goto('http://localhost:5190/', { timeout: 60000 });
    await page.waitForSelector('.aims-orbital-hero');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/mobile-${w}.png`, fullPage: false });
    await page.close();
  }
  await browser.close();
})();
