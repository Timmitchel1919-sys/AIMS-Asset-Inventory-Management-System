import {expect,test} from '@playwright/test';

test('new AIMS logo is visible on public, login, and sidebar surfaces',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.aims-brand img')).toBeVisible();
  await expect(page.locator('.aims-hero-orbit img')).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('kcs-auth','out'));
  await page.goto('/login');
  await expect(page.locator('.login-card .mobile-auth-logo')).toBeVisible();
  await page.evaluate(()=>{localStorage.setItem('kcs-auth','in');localStorage.setItem('kcs-role','administrator')});
  await page.goto('/dashboard');
  await expect(page.locator('.app-sidebar__logo-button img')).toBeVisible();
});
