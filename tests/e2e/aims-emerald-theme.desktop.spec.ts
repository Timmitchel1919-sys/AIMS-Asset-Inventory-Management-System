import{expect,test}from'@playwright/test';

test('Emerald is selectable internally while public routes and PWA branding remain Azure',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('kcs-auth','in');localStorage.setItem('kcs-role','administrator');localStorage.setItem('authenticatedThemePreference','aimsEmeraldGlass');localStorage.setItem('kcs-language','en')});
 await page.goto('/settings');
 await expect(page.locator('html')).toHaveAttribute('data-aims-theme','aimsEmeraldGlass');
 await expect(page.locator('.app-sidebar')).toHaveCSS('color','rgb(255, 255, 255)');
 await expect(page.locator('.app-sidebar__logo-button svg[data-logo-theme="emerald"]')).toBeVisible();
 await page.getByRole('button',{name:'Themes'}).click();
 await expect(page.getByRole('button',{name:/AIMS Emerald Glass/})).toBeVisible();
 await page.screenshot({path:'docs/design/aims-emerald-settings-desktop.png',fullPage:true});
 const primary=page.locator('.btn-primary').first();
 if(await primary.count())await expect(primary).toHaveCSS('color','rgb(255, 255, 255)');
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-aims-theme','aimsAzureGlass');
 await expect(page.locator('.aims-public-header .aims-mark')).toHaveAttribute('src','/aims-logo.png');
 await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href','/manifest-azure.webmanifest');
 await page.screenshot({path:'docs/design/aims-public-azure-desktop.png'});
 await page.goto('/dashboard');
 await expect(page.locator('html')).toHaveAttribute('data-aims-theme','aimsEmeraldGlass');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('authenticatedThemePreference'))).toBe('aimsEmeraldGlass');
});

test('login remains Azure even when Emerald is saved',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('kcs-auth','out');localStorage.setItem('authenticatedThemePreference','aimsEmeraldGlass')});
 await page.goto('/login');
 await expect(page.locator('html')).toHaveAttribute('data-aims-theme','aimsAzureGlass');
 await expect(page.locator('.auth-logo-lockup img')).toHaveAttribute('src','/aims-logo.png');
 await page.screenshot({path:'docs/design/aims-login-azure-desktop.png'});
});
