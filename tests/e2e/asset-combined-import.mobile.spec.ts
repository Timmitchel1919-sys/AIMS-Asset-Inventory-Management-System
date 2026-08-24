import {expect,test} from '@playwright/test';

test('combined asset import action and page fit the mobile viewport',async({page})=>{
  await page.goto('/assets');
  await page.getByLabel('Demo account').selectOption('administrator');
  const importButton=page.getByRole('button',{name:'Import',exact:true});
  await expect(importButton).toBeVisible();
  await expect(importButton).toHaveCSS('height','40px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await importButton.click();
  await expect(page).toHaveURL(/\/assets\/import$/);
  await expect(page.getByLabel('Bestand 1')).toBeVisible();
  await expect(page.getByLabel('Bestand 4')).toBeVisible();
  await expect(page.getByRole('button',{name:'Bestand analyseren'})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
