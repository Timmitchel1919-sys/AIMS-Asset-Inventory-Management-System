import{expect,test}from'@playwright/test';

test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('kcs-auth','out');localStorage.setItem('kcs-language','en')})});

test.describe('theme-responsive AIMS authentication',()=>{
  test('desktop login is accessible, validates input and preserves authentication',async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/login');
    await expect(page.locator('.auth-page')).toHaveAttribute('data-auth-theme','kcs-forest-gold');
    await expect(page.getByRole('heading',{name:'AIMS Asset & Inventory Management System'})).toBeVisible();
    await expect(page.getByAltText('AIMS logo')).toBeVisible();
    await expect(page.getByText('Sign in to continue to your secure, role-aware workspace.')).toHaveCount(0);
    await expect(page.locator('.auth-logo-lockup strong')).toHaveCount(0);
    await expect(page.locator('.auth-logo-lockup img')).toHaveAttribute('src','/aims-logo.png');
    await expect(page.locator('.auth-brand small')).toHaveText('St. Kangoeroe Community School');
    await expect.poll(()=>page.locator('.auth-page').evaluate(()=>{
      const brand=document.querySelector('.auth-brand-content')!.getBoundingClientRect();
      const card=document.querySelector('.auth-card')!.getBoundingClientRect();
      return Math.abs(brand.height-card.height);
    })).toBeLessThanOrEqual(1);
    const brandEdges=await page.locator('.auth-page').evaluate(()=>{
      const heading=document.querySelector('.auth-brand h1')!.getBoundingClientRect();
      const school=document.querySelector('.auth-brand small')!.getBoundingClientRect();
      const brand=document.querySelector('.auth-brand-content')!.getBoundingClientRect();
      return{top:Math.abs(heading.top-brand.top),schoolInside:school.bottom<=brand.bottom};
    });
    expect(brandEdges.top).toBeLessThanOrEqual(2);
    expect(brandEdges.schoolInside).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);

    const email=page.getByLabel('Email address'),password=page.locator('#auth-password');
    await page.keyboard.press('Tab');
    await expect(email).toBeFocused();
    await email.fill('invalid');
    await page.getByRole('button',{name:'Sign in'}).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.');
    await expect(email).toHaveAttribute('aria-invalid','true');
    await page.getByRole('button',{name:'Show or hide password'}).click();
    await expect(password).toHaveAttribute('type','text');

    await email.fill('naomi@kangoeroeschool.com');
    const signIn=page.getByRole('button',{name:'Sign in'}),submit=page.locator('.auth-submit');
    await signIn.click();
    await expect(submit).toHaveAttribute('aria-busy','true');
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
