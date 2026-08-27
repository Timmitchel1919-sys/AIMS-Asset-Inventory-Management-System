import {expect,test} from '@playwright/test';

test('AIMS emblem and shared wordmark are visible on their approved surfaces',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.aims-brand img')).toBeVisible();
  await expect(page.locator('.aims-brand .brand-wordmark')).toBeVisible();
  await expect(page.locator('.aims-orbital-hero img')).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('kcs-auth','out'));
  await page.goto('/login');
  await expect(page.locator('.login-card .brand-wordmark--auth')).toHaveCount(0);
  await expect(page.locator('.login-card img')).toHaveCount(0);
  await page.evaluate(()=>{localStorage.setItem('kcs-auth','in');localStorage.setItem('kcs-role','administrator')});
  await page.goto('/dashboard');
  await expect(page.locator('.app-sidebar__logo-button img')).toBeVisible();
});
