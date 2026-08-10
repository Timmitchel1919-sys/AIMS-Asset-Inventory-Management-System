import{expect,test}from'@playwright/test';

test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('kcs-auth','in');localStorage.setItem('kcs-role','administrator');localStorage.setItem('kcs-language','en')})});

test('admin navigation is consolidated and responsive',async({page})=>{
  await page.goto('/dashboard');
  await expect(page.locator('.sidebar-foot a[href="/admin"]')).toBeVisible();
  await expect(page.locator('.sidebar')).not.toContainText('Download app');
  await expect(page.locator('.sidebar-foot')).toContainText(/Log out/i);
  await page.getByRole('button',{name:/open profile menu/i}).click();
  await expect(page.getByRole('menu')).toContainText('My Profile');
  await expect(page.getByRole('menu')).toContainText('Preferences');
  await expect(page.getByRole('menu')).not.toContainText('Admin Console');
  await page.goto('/admin');
  for(const path of ['users','roles-permissions','activity-log','settings'])await expect(page.locator(`.admin-console-grid a[href="/admin/${path}"]`)).toBeVisible();
  await expect(page.locator('.admin-console-grid a[href="/admin/ai-assistant"]')).toHaveCount(0);
  const disposal=page.locator('.sidebar nav a[href="/disposals"]');
  await expect(disposal).toBeVisible();
  const navigationOrder=await page.locator('.sidebar nav a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  expect(navigationOrder.indexOf('/disposals')).toBe(navigationOrder.indexOf('/reports')+1);
  await page.screenshot({path:'docs/design/admin-overview-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.bottom-nav button').click();
  await expect(page.locator('.sidebar-foot a[href="/admin"]')).toBeVisible();
  await page.screenshot({path:'docs/design/admin-navigation-mobile.png',fullPage:true});
});

test('non-admin users cannot see or open administration',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kcs-role','ict-staff'));
  await page.goto('/dashboard');
  await expect(page.locator('.sidebar-foot a[href="/admin"]')).toHaveCount(0);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByRole('heading',{name:/permission required/i})).toBeVisible();
});
