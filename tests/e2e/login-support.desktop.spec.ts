import{test,expect}from'@playwright/test';
test('login ICT support dialog is complete and accessible',async({page})=>{
 const errors:string[]=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('kcs-auth','out'));await page.goto('/login');
 await page.getByRole('button',{name:'Need help? Contact ICT Support'}).click();
 await expect(page.getByRole('dialog',{name:'ICT Support'})).toBeVisible();
 await expect(page.getByText('SUBMIT YOUR ISSUE THROUGH THE TICKET SYSTEM FIRST.')).toBeVisible();
 await expect(page.getByText('Monday–Friday: 07:30 A.M. – 14:00 P.M.')).toBeVisible();
 await expect(page.locator('.ict-contact-grid article')).toHaveCount(6);
 await expect(page.getByRole('link',{name:'Submit a support ticket'})).toHaveAttribute('href','/support#ticket-system');
 const box=await page.getByRole('dialog').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(1366);
 await page.screenshot({path:'C:/Users/Administrator/AppData/Local/Temp/kcs-login-support.png'});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(errors).toEqual([]);
});
