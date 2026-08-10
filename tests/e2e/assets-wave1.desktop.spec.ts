import {expect,test} from '@playwright/test';

test.describe('Wave 1 Assets list',()=>{
  test.beforeEach(async({page})=>{await page.goto('/assets');await expect(page.getByRole('heading',{level:1,name:/ICT assets/i})).toBeVisible();await expect(page.getByTestId('table-assets')).toBeVisible()});

  test('repository search, advanced filters, numeric sort and cursor pagination work',async({page})=>{
    await page.getByPlaceholder(/search code/i).fill('KCSMD');
    await expect(page.getByTestId('table-assets').getByRole('row')).toHaveCount(6);
    await page.getByRole('button',{name:/filters/i}).click();
    await page.locator('.advanced-filter-panel label:has-text("Asset status") select').selectOption('Assigned');
    await expect(page.getByTestId('table-assets')).toContainText('KCSMD-147');
    await page.getByRole('button',{name:/clear all filters/i}).click();
    await page.getByPlaceholder(/search code/i).fill('');
    await page.getByRole('button',{name:/^Code/i}).click();
    await expect(page.getByRole('button',{name:/next/i})).toBeEnabled();
    await page.getByRole('button',{name:/next/i}).click();
    await expect(page.getByRole('button',{name:/previous/i})).toBeEnabled();
  });

  test('saved views and column preferences persist after reload',async({page})=>{
    await page.getByPlaceholder(/search code/i).fill('Cisco');
    await page.getByText('Columns',{exact:true}).click();
    await page.locator('.list-menu').filter({hasText:'Columns'}).getByRole('checkbox',{name:'Serial number'}).uncheck();
    await page.getByText('Views',{exact:true}).click();
    await page.getByRole('button',{name:/save current view/i}).click();
    await page.getByLabel('View name').fill('Network assets');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.reload();
    await page.getByText('Views',{exact:true}).click();
    await expect(page.getByRole('button',{name:'Network assets',exact:true})).toBeVisible();
    await page.getByText('Columns',{exact:true}).click();
    await expect(page.locator('.list-menu').filter({hasText:'Columns'}).getByRole('checkbox',{name:'Serial number'})).not.toBeChecked();
  });

  test('permission-authorized bulk archive requires a reason and reports success',async({page})=>{
    const checkboxes=page.getByTestId('table-assets').getByRole('checkbox');
    await checkboxes.nth(1).check();await checkboxes.nth(2).check();
    await page.getByRole('region',{name:'Bulk action'}).getByRole('combobox').selectOption('archive');
    await page.getByRole('button',{name:'Apply',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button',{name:'Apply'})).toBeDisabled();
    await page.getByLabel('Reason').fill('Wave 1 acceptance');
    await page.getByRole('dialog').getByRole('button',{name:'Apply'}).click();
    await expect(page.getByRole('status')).toContainText(/completed/i);
  });

  test('empty and recoverable repository-error states are accessible',async({page})=>{
    await page.goto('/assets?state=empty');await expect(page.getByRole('heading',{name:/No assets found/i})).toBeVisible();
    await page.goto('/assets?state=error');await expect(page.getByRole('heading',{name:/Unable to load assets/i})).toBeVisible();
    await page.getByRole('button',{name:/try again/i}).click();await expect(page.getByTestId('table-assets')).toBeVisible();
  });

  test('Dutch mobile cards, controls and labels fit at 375px',async({page})=>{
    await page.setViewportSize({width:375,height:800});
    await page.evaluate(()=>localStorage.setItem('kcs-language','nl'));
    await page.reload();
    await expect(page.getByRole('heading',{name:'ICT-middelen'})).toBeVisible();
    await expect(page.locator('.mobile-records article').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expect(page.getByRole('button',{name:/filters/i})).toBeVisible();
  });
});
