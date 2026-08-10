import{expect,test}from'@playwright/test';

test.describe('Presentation Candidate 1',()=>{
  test('shows simulation boundaries, switches persona and restores deterministic data',async({page})=>{
    await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear()});
    await page.goto('/dashboard');
    const strip=page.getByRole('region',{name:'Presentation environment'});
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Fictional demonstration data');
    const disposalLink=page.locator('.sidebar a[href="/disposals"]'),assistantLink=page.locator('.sidebar a[href="/assistant"]');
    await expect(assistantLink).toHaveCount(1);
    expect(await disposalLink.evaluate((disposal,assistant)=>Boolean(disposal.compareDocumentPosition(assistant as Node)&Node.DOCUMENT_POSITION_FOLLOWING),await assistantLink.elementHandle())).toBe(true);
    await page.screenshot({path:'docs/presentation-screenshots/dashboard.png',fullPage:true});
    await strip.getByLabel('Demo account').selectOption('auditor');
    await expect(page.getByRole('button',{name:'Open profile'})).toContainText('AA');
    await expect(page.locator('.sidebar a[href="/users"]')).toHaveCount(0);
    await strip.getByLabel('Demo account').selectOption('administrator');
    page.once('dialog',dialog=>dialog.accept());
    await strip.getByRole('button',{name:'Reset demo data'}).click();
    await page.goto('/assets');
    await expect(page.getByText('KCSL-125',{exact:true}).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({path:'docs/presentation-screenshots/assets.png',fullPage:true});
    await page.goto('/assistant');
    await expect(page.getByText('Mock AI provider · read only')).toBeVisible();
    await page.screenshot({path:'docs/presentation-screenshots/assistant.png',fullPage:true});
  });
});
