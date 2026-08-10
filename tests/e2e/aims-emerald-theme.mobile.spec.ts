import{expect,test}from'@playwright/test';

test('protected mobile UI uses Emerald while the public mobile UI remains Azure',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('kcs-auth','in');localStorage.setItem('kcs-role','administrator');localStorage.setItem('authenticatedThemePreference','aimsEmeraldGlass')});
 await page.goto('/dashboard');
 await expect(page.locator('html')).toHaveAttribute('data-aims-theme','aimsEmeraldGlass');
 await expect(page.locator('.topbar')).toHaveCSS('height','58px');
 await page.screenshot({path:'docs/design/aims-emerald-dashboard-mobile.png',fullPage:true});
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-aims-theme','aimsAzureGlass');
 await expect(page.locator('.aims-public-header .aims-mark')).toHaveAttribute('src','/aims-logo.png');
});
