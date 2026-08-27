const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:5190/', { timeout: 60000 });
  await page.waitForSelector('.aims-orbital-hero');
  // Freeze at t=0 by checking immediately
  const info = await page.evaluate(() => {
    const hero = document.querySelector('.aims-orbital-hero').getBoundingClientRect();
    const cx = hero.left + hero.width/2, cy = hero.top + hero.height/2;
    const chips = [...document.querySelectorAll('.aims-orbital-chip')].map(el => {
      const r = el.getBoundingClientRect();
      const label = el.querySelector('.aims-orbital-chip-label').textContent;
      return { label, dx: Math.round(r.left + r.width/2 - cx), dy: Math.round(r.top + r.height/2 - cy), transform: getComputedStyle(el).transform };
    });
    const anchors = [...document.querySelectorAll('.aims-orbital-anchor')].map(el => el.style.transform);
    return { cx, cy, chips, anchors };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
