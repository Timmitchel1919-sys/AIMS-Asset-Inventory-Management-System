const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const widths = [320,360,390,430,768,1024,1280,1440,1920];
  const results = [];
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors = [];
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: '+e.message));
    await page.addInitScript(() => localStorage.setItem('kcs-auth', 'out'));
    await page.goto('http://localhost:5190/', { timeout: 60000 });
    await page.waitForSelector('.aims-orbital-hero');
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    results.push({ w, overflow, errors });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
