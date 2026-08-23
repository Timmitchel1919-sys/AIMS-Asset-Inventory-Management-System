import {expect,test} from '@playwright/test';

test('authorized ICT asset import action opens the combined workbook page on desktop',async({page})=>{
  const consoleErrors:string[]=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await page.goto('/assets');
  await page.getByLabel('Demo account').selectOption('administrator');
  const importButton=page.getByRole('button',{name:'Import',exact:true});
  const addButton=page.getByRole('button',{name:'Add asset',exact:true});
  await expect(importButton).toBeVisible();
  const [importBox,addBox]=await Promise.all([importButton.boundingBox(),addButton.boundingBox()]);
  expect(importBox?.height).toBe(addBox?.height);
  expect(importBox?.y).toBe(addBox?.y);
  await importButton.click();
  await expect(page).toHaveURL(/\/assets\/import$/);
  await expect(page.getByLabel('Bestand 1')).toBeVisible();
  await expect(page.getByLabel('Bestand 4')).toBeVisible();
  const analyzeButton=page.getByRole('button',{name:'Bestand analyseren'});
  await expect(analyzeButton).toBeDisabled();
  await page.getByLabel('Bestand 1').setInputFiles({name:'Bestand 1.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('test')});
  await expect(analyzeButton).toBeEnabled();
  await expect(page.getByText(/CSV or Excel-compatible text/i)).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('asset import action is hidden for roles without assets.import',async({page})=>{
  await page.goto('/assets');
  await page.getByLabel('Demo account').selectOption('auditor');
  await expect(page.getByRole('button',{name:'Import',exact:true})).toHaveCount(0);
});
