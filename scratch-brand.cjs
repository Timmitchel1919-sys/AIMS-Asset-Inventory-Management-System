const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('response', r => { if (r.url().includes('logo') || r.status() >= 400) console.log(r.status(), r.url()); });
  await page.goto('http://localhost:4174/', { timeout: 60000 });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const el = document.querySelector('.aims-brand img');
    if (!el) return 'NOT FOUND';
    const r = el.getBoundingClientRect();
    return { src: el.src, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, rect: r, display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
