const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('http://localhost:4174/', { timeout: 60000 });
  await page.waitForTimeout(500);
  const html = await page.evaluate(() => {
    const el = document.querySelector('.aims-brand');
    return el ? el.outerHTML.slice(0, 800) : 'NO .aims-brand';
  });
  console.log(html);
  await browser.close();
})();
