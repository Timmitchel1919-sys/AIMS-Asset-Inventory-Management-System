const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const themes = [
    { name: 'blue', value: null },
    { name: 'midnight', value: 'aimsMidnight' },
    { name: 'emerald', value: 'aimsEmeraldGloss' },
  ];
  const errors = [];
  for (const t of themes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`[${t.name}] ${msg.text()}`); });
    page.on('pageerror', err => errors.push(`[${t.name}] pageerror: ${err.message}`));
    await page.addInitScript((theme) => {
      localStorage.setItem('kcs-auth', 'out');
      if (theme) localStorage.setItem('authenticatedThemePreference', theme);
    }, t.value);
    await page.goto('http://localhost:5190/', { timeout: 60000 });
    await page.waitForSelector('.aims-orbital-hero');
    await page.waitForTimeout(600);
    const el = await page.$('.aims-hero-grid');
    await el.screenshot({ path: `/tmp/orbit-${t.name}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(t.name, 'overflow px:', overflow);
    await page.close();
  }
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  await browser.close();
})();
