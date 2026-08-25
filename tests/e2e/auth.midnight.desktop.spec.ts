import{expect,test}from'@playwright/test';

test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('kcs-auth','out');localStorage.setItem('kcs-language','en');localStorage.setItem('authenticatedThemePreference','aimsMidnight')})});

test.describe('theme-responsive AIMS authentication',()=>{
  test('desktop login is accessible, validates input and preserves authentication',async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/login');
    await expect(page.locator('.auth-page')).toHaveAttribute('data-auth-theme','aimsMidnight');
    await expect(page.getByAltText('AIMS logo')).toHaveCount(1);
    await expect(page.getByRole('img',{name:'AIMS Asset & Inventory Management System'})).toBeVisible();
    await expect(page.getByLabel('Choose language')).toHaveCount(0);
    await expect(page.getByText('Sign in to continue to your secure, role-aware workspace.')).toHaveCount(0);
    await expect(page.locator('.auth-logo-lockup strong')).toHaveCount(0);
    await expect(page.locator('.auth-logo-lockup img')).toHaveCount(0);
    await expect(page.locator('.auth-card')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme','aims-midnight');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);

    const email=page.getByLabel('Email address'),password=page.getByLabel('Password',{exact:true});
    await page.keyboard.press('Tab');
    await expect(email).toBeFocused();
    await email.fill('invalid');
    await page.getByRole('button',{name:'Sign in'}).click();
    expect(await email.evaluate(element=>(element as HTMLInputElement).checkValidity())).toBe(false);
    await page.getByRole('button',{name:'Show or hide password'}).click();
    await expect(password).toHaveAttribute('type','text');

    await email.fill('naomi@kangoeroeschool.com');
    await password.fill('presentation-only');
    const signIn=page.getByRole('button',{name:'Sign in'});
    await signIn.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('mobile login has no overflow and maintains touch targets',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/login');
    await expect(page.locator('.auth-mobile-header')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const sizes=await page.locator('.auth-card button,.auth-card input:not([type="checkbox"]),.login-options label').evaluateAll(elements=>elements.map(element=>{const box=element.getBoundingClientRect();return{width:box.width,height:box.height}}));
    expect(sizes.every(size=>size.height>=44),JSON.stringify(sizes)).toBe(true);
  });

  test('Google sign-in and reduced motion remain operational',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/login');
    const duration=await page.locator('.auth-card').evaluate(element=>getComputedStyle(element).animationDuration);
    expect(Number.parseFloat(duration)).toBeLessThanOrEqual(.00001);
    await page.getByRole('button',{name:'Continue with Google'}).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
