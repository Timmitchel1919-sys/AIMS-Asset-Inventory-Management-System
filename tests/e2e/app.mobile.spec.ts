import{expect,test}from'@playwright/test';
test.describe('KCS mobile acceptance',()=>{
  test('logout returns to landing and sign in returns to the platform',async({page})=>{
    await page.goto('/dashboard');
    await page.getByRole('button',{name:/open account menu/i}).click();
    await page.getByRole('menuitem',{name:/sign out/i}).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button',{name:/open navigation/i}).click();
    await page.getByRole('link',{name:/sign in/i}).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('button',{name:/sign in/i}).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('drawer navigation, mobile cards and touch layout work without overflow',async({page})=>{
    for(const path of ['/dashboard','/assets','/inventory','/assignments','/borrow','/repairs','/maintenance','/movements','/audits','/disposals','/reports','/settings']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${path} overflow`).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));await expect(page.getByRole('heading',{level:1})).toBeVisible()}
    await page.goto('/dashboard');const menuButton=page.getByRole('button',{name:/open navigation/i});await expect(menuButton.locator('svg.lucide-menu')).toBeVisible();await expect(menuButton.locator('img')).toHaveCount(0);await menuButton.click();const drawer=page.getByRole('complementary',{name:/primary navigation/i});await expect(drawer).toBeVisible();await drawer.getByRole('link',{name:/ICT Assets|ICT-middelen/}).click();await expect(page).toHaveURL(/\/assets$/);await expect(page.locator('.mobile-records article').first()).toBeVisible();
  });
  test('required responsive widths and three themes do not overflow',async({page})=>{
    for(const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]){await page.setViewportSize({width,height});await page.goto('/dashboard');expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${width}x${height}`).toBeLessThanOrEqual(width)}
    await page.setViewportSize({width:390,height:844});await page.goto('/settings');await page.getByRole('button',{name:/Themes/i}).click();for(const name of ['KCS Forest Gold','KCS Azure Intelligence']){await page.getByRole('button',{name:new RegExp(name)}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)}
  });
  test('offline and install guidance are explicit about mock limitations',async({page})=>{
    await page.goto('/offline');await expect(page.getByText(/not durably synchronized/i)).toBeVisible();
  });
  test('asset Wave 2 routes remain usable in English and Dutch on mobile',async({page})=>{
    for(const path of ['/assets/new','/assets/ast-001','/assets/ast-001/history','/assets/ast-002/assign','/assets/ast-002/move','/assets/ast-001/labels','/assets/ast-002/disposal','/assets/import']){await page.goto(path);await expect(page.getByRole('heading',{level:1})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${path} overflow`).toBeLessThanOrEqual(390)}
    await page.evaluate(()=>localStorage.setItem('kcs-language','nl'));await page.goto('/assets/ast-001');await expect(page.getByRole('button',{name:/Middel bewerken/i})).toBeVisible();await expect(page.getByRole('tab',{name:/Technische details/i})).toBeVisible();
  });
  test('QR scanner manual fallback opens the matching asset detail',async({page})=>{
    await page.goto('/assets?scan=1');
    await expect(page.getByRole('heading',{name:'Scan QR code'})).toBeVisible();
    await page.getByLabel('KCS code or QR link').fill('KCSMD-147');
    await page.getByRole('button',{name:'Open asset'}).click();
    await expect(page).toHaveURL(/\/assets\/ast-001$/);
    await expect(page.getByText('KCSMD-147').first()).toBeVisible();
  });
});
