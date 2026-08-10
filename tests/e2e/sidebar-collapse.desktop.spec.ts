import{expect,test}from'@playwright/test';

async function expectCenteredIcon(link:import('@playwright/test').Locator){
  await expect(link).toHaveCSS('width','48px');
  await expect(link).toHaveCSS('height','48px');
  await expect(link).toHaveCSS('padding-left','0px');
  await expect(link).toHaveCSS('justify-content','center');
  const box=await link.boundingBox();
  const iconBox=await link.locator('.navigation-item__icon').boundingBox();
  expect(box).not.toBeNull();expect(iconBox).not.toBeNull();
  expect(Math.abs((box!.x+box!.width/2)-(iconBox!.x+iconBox!.width/2))).toBeLessThanOrEqual(.5);
  expect(Math.abs((box!.y+box!.height/2)-(iconBox!.y+iconBox!.height/2))).toBeLessThanOrEqual(.5);
}
test('desktop sidebar collapses, persists, expands from logo, and supports both themes',async({page})=>{await page.addInitScript(()=>{if(localStorage.getItem('kcs-sidebar-collapsed')===null)localStorage.setItem('kcs-sidebar-collapsed','false');localStorage.setItem('kcs-language','en')});await page.goto('/dashboard');const sidebar=page.getByRole('complementary',{name:/primary navigation/i});await expect(sidebar).toHaveCSS('width','248px');await expect(sidebar.getByRole('button',{name:'Log out'})).toBeVisible();await expect(sidebar.getByRole('button',{name:'Collapse sidebar'})).toBeVisible();for(const theme of ['kcs-forest-gold','kcs-azure-intelligence']){await page.evaluate(value=>{document.documentElement.dataset.theme=value;localStorage.setItem('kcs-theme',value)},theme);await sidebar.getByRole('button',{name:'Collapse sidebar'}).focus();await page.keyboard.press('Enter');await expect(sidebar).toHaveCSS('width','76px');const dashboard=sidebar.getByRole('link',{name:'Dashboard'});await expect(dashboard).toHaveAttribute('title','Dashboard');await expect(dashboard).toHaveAttribute('aria-current','page');await expectCenteredIcon(dashboard);await dashboard.hover();await expectCenteredIcon(dashboard);await dashboard.focus();await expectCenteredIcon(dashboard);await expect(sidebar.locator('.navigation-item__label').first()).toHaveCSS('display','none');await expect(sidebar.getByRole('button',{name:'Collapse sidebar'})).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>localStorage.getItem('kcs-sidebar-collapsed'))).toBe('true');await page.screenshot({path:`docs/design/sidebar-collapsed-${theme}.png`});await page.reload();await expect(sidebar).toHaveCSS('width','76px');await sidebar.getByRole('button',{name:'Expand sidebar'}).focus();await page.keyboard.press('Space');await expect(sidebar).toHaveCSS('width','248px');await expect(sidebar.getByRole('button',{name:'Log out'})).toBeVisible()}await page.screenshot({path:'docs/design/sidebar-expanded.png'})});
