import {expect,test} from '@playwright/test';

test('unknown global search stays stable on mobile',async({page})=>{
  const errors:string[]=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto('/dashboard');
  const search=page.getByRole('combobox',{name:/global search/i});
  await search.fill('item-that-does-not-exist');
  const emptyState=page.getByText(/No results found/);
  await expect(emptyState).toBeVisible();
  await page.waitForTimeout(600);
  await expect(emptyState).toBeVisible();
  await expect(page.getByRole('listbox')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
