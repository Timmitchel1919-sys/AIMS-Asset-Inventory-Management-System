const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('kcs-auth', 'out'));
  await page.goto('http://localhost:5190/', { timeout: 60000 });
  await page.waitForSelector('.aims-orbital-hero');
  const first = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.aims-orbital-chip')];
    return chips.map(c => getComputedStyle(c).transform);
  });
  await page.waitForTimeout(1500);
  const second = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.aims-orbital-chip')];
    return chips.map(c => getComputedStyle(c).transform);
  });
  console.log('t0', JSON.stringify(first));
  console.log('t1.5s', JSON.stringify(second));
  console.log('static (should match):', JSON.stringify(first) === JSON.stringify(second));
  await page.screenshot({ path: '/tmp/orbit-reduced-motion.png', clip: { x: 700, y: 0, width: 740, height: 700 } });
  await browser.close();
})();
