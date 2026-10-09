const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5175/assets', { waitUntil: 'networkidle' });
  
  // Wait a bit to ensure rendering
  await page.waitForTimeout(2000);
  
  const text = await page.evaluate(() => {
    const errorEl = document.querySelector('.bg-red-50');
    if (errorEl) return errorEl.textContent;
    return document.body.innerText.substring(0, 500);
  });
  
  console.log('--- OUTPUT ---');
  console.log(text);
  
  await browser.close();
})().catch(console.error);
