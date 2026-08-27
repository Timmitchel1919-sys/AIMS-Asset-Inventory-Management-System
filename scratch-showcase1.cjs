const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.addInitScript(() => localStorage.setItem('kcs-auth', 'out'));
  await page.goto('http://localhost:5190/', { timeout: 60000 });
  const section = page.locator('.aims-showcase-section');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await section.screenshot({ path: '/tmp/showcase-section.png' });
  const visibility = await page.evaluate(() => {
    const get = sel => { const el = document.querySelector(sel); if (!el) return 'MISSING'; return getComputedStyle(el).display; };
    return {
      desktop: get('.aims-showcase-section .aims-stage-desktop'),
      laptop: get('.aims-showcase-section .aims-stage-laptop'),
      tablet: get('.aims-showcase-section .aims-stage-tablet'),
      mobile: get('.aims-showcase-section .aims-stage-mobile'),
    };
  });
  console.log(JSON.stringify(visibility, null, 2));
  await browser.close();
})();
