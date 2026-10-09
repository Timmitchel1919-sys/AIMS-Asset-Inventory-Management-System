const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Wait for the dev server to be ready
  await page.waitForTimeout(3000);
  
  // Navigate to the assets page
  await page.goto('http://localhost:5173/assets');
  
  // Wait for the error boundary to appear (or the page to load)
  await page.waitForTimeout(2000);
  
  // Get the error text if present
  const errorText = await page.evaluate(() => {
    const errorEl = document.querySelector('.bg-red-50');
    return errorEl ? errorEl.textContent : 'No error found on screen.';
  });
  
  console.log('Error output from screen:', errorText);
  
  await browser.close();
})();

