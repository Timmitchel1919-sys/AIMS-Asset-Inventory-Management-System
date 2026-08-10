import{test,expect}from'@playwright/test';
test('mobile ICT support bottom sheet stays within viewport',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('kcs-auth','out');localStorage.setItem('kcs-language','nl')});await page.goto('/login');
 await page.getByRole('button',{name:'Hulp nodig? Neem contact op met ICT-ondersteuning'}).click();const dialog=page.getByRole('dialog',{name:'ICT-ondersteuning'});
 await expect(dialog).toBeVisible();await expect(page.getByText('DIEN UW PROBLEEM EERST IN VIA HET TICKETSYSTEEM.')).toBeVisible();await expect(page.locator('.ict-contact-grid article')).toHaveCount(6);
 const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.width).toBeLessThanOrEqual(390);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
