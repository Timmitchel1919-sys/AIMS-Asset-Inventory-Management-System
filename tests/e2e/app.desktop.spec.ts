import{expect,test,type Page}from'@playwright/test';

async function signedOut(page:Page){await page.addInitScript(()=>localStorage.setItem('kcs-auth','out'))}
async function openFirstRecord(page:Page){await page.locator('tbody tr').first().click()}

test.describe('KCS desktop frontend acceptance',()=>{
  test('logout returns to landing and sign in returns to the platform',async({page})=>{
    await page.goto('/dashboard');
    await page.getByRole('button',{name:/open account menu/i}).click();
    await page.getByRole('menuitem',{name:/sign out/i}).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('link',{name:/sign in/i}).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('button',{name:/sign in/i}).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('all public routes load and mock authentication protects direct routes',async({page})=>{
    await signedOut(page);
    for(const path of ['/login','/register','/forgot-password','/reset-password']){await page.goto(path);await expect(page.getByRole('main')).toBeVisible();await expect(page.getByRole('heading').first()).toBeVisible()}
    await page.goto('/assets');await expect(page).toHaveURL(/\/login$/);await page.getByRole('button',{name:/sign in/i}).click();await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('all named routes load directly without framework or route errors',async({page})=>{
    test.setTimeout(60_000);
    const paths=['/dashboard','/assets','/assets/new','/assets/import','/assets/ast-001/edit','/assets/ast-001','/assets/ast-001/history','/assets/ast-002/assign','/assets/ast-002/move','/assets/ast-001/labels','/assets/ast-002/disposal','/inventory','/inventory/new','/inventory/import','/inventory/inv-1','/inventory/inv-1/edit','/inventory/receive','/inventory/issue','/inventory/transfer','/inventory/return','/inventory/correct','/inventory/reservations','/inventory/low-stock','/categories','/categories/new','/categories/cat-1','/categories/cat-1/edit','/locations','/locations/new','/locations/loc-1','/locations/loc-1/edit','/departments','/departments/new','/departments/dep-1','/departments/dep-1/edit','/assignments','/borrow','/borrow/new','/borrow/br1','/service-forms','/repairs','/repairs/rp1','/maintenance','/movements','/movements/new','/audits','/audits/new','/audits/au1','/reports','/notifications','/assistant','/users','/roles','/activity','/disposals','/disposals/new','/disposals/dsp-0001','/settings','/offline','/403','/does-not-exist'];
    for(const path of paths){await page.goto(path);await expect(page.locator('body')).not.toContainText(/Unable to display this page|ReferenceError|TypeError/);await expect(page.getByRole('heading').first()).toBeVisible()}
  });

  test('asset creation, filtering, editing, QR detail, archive and restore',async({page})=>{
    await page.goto('/assets/new');await page.getByLabel(/asset name/i).fill('Acceptance Laptop');await page.getByLabel(/^Category/i).selectOption('Laptops');await page.getByLabel(/serial number/i).fill('ACC-UNIQUE-101');await page.getByLabel(/^Location/i).selectOption('ICT Store');await page.getByLabel(/department/i).fill('ICT');await page.getByRole('button',{name:/save asset/i}).click();await expect(page.getByRole('heading',{name:/asset created/i})).toBeVisible();
    await page.getByRole('button',{name:/return to asset record/i}).click();await expect(page.getByText(/Secure QR label/i)).toBeVisible();await page.getByRole('button',{name:/back to assets/i}).click();await page.getByPlaceholder(/search code/i).fill('Acceptance Laptop');const assetRow=page.getByTestId('table-assets').getByRole('row').filter({hasText:'Acceptance Laptop'});await expect(assetRow).toBeVisible();await assetRow.click();await page.getByRole('button',{name:/edit asset/i}).click();await page.getByLabel(/^Location/i).selectOption('Server Room');await page.getByRole('button',{name:/save asset/i}).click();await page.getByRole('button',{name:/return to asset record/i}).click();await page.getByRole('button',{name:/archive/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await expect(page.getByRole('status')).toContainText(/archived/i);await page.getByRole('button',{name:/restore/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await expect(page.getByRole('status')).toContainText(/restored/i);
  });

  test('asset digital card tabs, unified history and explicit error states work',async({page})=>{
    await page.goto('/assets/ast-001');await expect(page.getByText(/Secure QR label/i)).toBeVisible();for(const name of ['Technical details','Assignment history','Location history','Borrow history','Repair history','Maintenance history','Movement history','Audit history','Status history','Documents','Accessories','Lifecycle and disposal']){await page.getByRole('tab',{name}).click();await expect(page.getByRole('tabpanel')).toBeVisible()}
    await page.goto('/assets/ast-001/history');await expect(page.getByRole('heading',{name:/Asset history/i})).toBeVisible();await page.locator('.asset-history-timeline button').first().click();await expect(page.getByText('Before',{exact:true}).first()).toBeVisible();
    await page.goto('/assets/not-real');await expect(page.getByRole('heading',{name:/Asset not found/i})).toBeVisible();await page.goto('/assets/ast-001?state=error');await expect(page.getByRole('button',{name:/try again/i})).toBeVisible();
  });

  test('asset-specific assignment and movement update centralized history',async({page})=>{
    await page.goto('/assets/ast-002/assign');await page.getByLabel(/Person/i).fill('Wave Two User');await page.getByRole('button',{name:/confirm/i}).click();await expect(page).toHaveURL(/\/assets\/ast-002\/history$/);await expect(page.locator('.asset-history-timeline')).toContainText(/Wave Two User/);
    await page.goto('/assets/ast-006/move');await page.getByLabel(/Destination location/i).fill('ICT Store');await page.getByLabel(/Destination department/i).fill('ICT');await page.getByLabel(/Movement reason/i).fill('Wave Two deployment');await page.getByLabel(/^Responsible employee/i).fill('Naomi Williams');await page.getByRole('button',{name:/confirm/i}).click();await page.getByRole('dialog').getByRole('button',{name:/confirm/i}).click();await expect(page).toHaveURL(/\/assets\/ast-006\/history$/);await expect(page.getByText(/Wave Two deployment/).first()).toBeVisible();
  });

  test('asset labels, disposal initiation and staged import complete mock workflows',async({page})=>{
    await page.goto('/assets/ast-001/labels');await expect(page.getByRole('img',{name:/Labels: KCSMD-147/i})).toBeVisible();await page.getByLabel(/Copies/i).fill('2');await expect(page.locator('.asset-label')).toHaveCount(2);
    await page.goto('/assets/ast-002/disposal');await page.getByLabel(/Disposal reason/i).fill('Lifecycle review');await page.getByLabel(/Technical assessment/i).fill('Replacement recommended');await page.getByRole('button',{name:/confirm/i}).click();await page.getByRole('dialog').getByRole('button',{name:/confirm/i}).click();await expect(page).toHaveURL(/\/assets\/ast-002$/);
    await page.goto('/assets/import');await page.getByLabel(/CSV or Excel-compatible text/i).fill('code,name,serialnumber,category,location,department\nBAD,,IMP-X,Unknown,Nowhere,None');await page.getByRole('button',{name:/Parse records/i}).click();await expect(page.getByText('INVALID_CODE')).toBeVisible();await expect(page.getByRole('button',{name:/Commit valid records/i})).toBeDisabled();await page.getByLabel(/CSV or Excel-compatible text/i).fill('code,name,serialnumber,category,location,department\nKCSMD-300,Imported desktop,IMP-300,Laptops,ICT Store,ICT');await page.getByRole('button',{name:/Parse records/i}).click();await page.getByRole('button',{name:/Commit valid records/i}).click();await expect(page.getByRole('status')).toContainText(/Import completed/i);
  });

  test('inventory receive and issue create state feedback',async({page})=>{
    await page.goto('/inventory/receive');await page.getByLabel(/^Item/i).selectOption('inv-1');await page.getByLabel(/quantity/i).fill('3');await page.getByLabel(/destination/i).fill('Shelf A-04');await page.getByLabel(/reason/i).fill('Acceptance receipt');await page.getByRole('button',{name:/receive stock/i}).click();await expect(page.getByRole('status')).toContainText(/updated/i);await page.goto('/inventory/issue');await page.getByLabel(/^Item/i).selectOption('inv-1');await page.getByLabel(/quantity/i).fill('1');await page.getByLabel(/department/i).fill('ICT');await page.getByLabel(/purpose/i).fill('Acceptance issue');await page.getByLabel(/reason/i).fill('Approved request');await page.getByRole('button',{name:/issue stock/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await expect(page.getByRole('status')).toContainText(/updated/i);
  });

  test('assignment creation and return preserve history',async({page})=>{
    await page.goto('/assignments');await page.getByRole('button',{name:/assign asset/i}).click();await page.getByLabel(/assigned person/i).fill('Acceptance Person');await page.getByLabel(/^Department/i).fill('ICT');await page.getByLabel(/^Location/i).fill('ICT Store');await page.getByRole('textbox',{name:'Signature (mock)'}).fill('Acceptance Person');await page.getByRole('button',{name:/confirm assignment/i}).click();const assignmentRow=page.getByTestId('table-assignments').getByRole('row').filter({hasText:'Acceptance Person'});await expect(assignmentRow).toBeVisible();await assignmentRow.click();await page.getByRole('button',{name:/register return/i}).click();await page.getByLabel(/receipt signature/i).fill('Naomi');await page.getByRole('button',{name:/confirm return/i}).click();await expect(page.getByRole('dialog',{name:/register return/i})).not.toBeVisible();await expect(assignmentRow).toContainText(/Returned/i);
  });

  test('borrow approval, issue and return lifecycle',async({page})=>{
    await page.goto('/borrow/new');await page.getByLabel(/borrower/i).fill('Acceptance Borrower');await page.getByLabel(/^Department/i).fill('ICT');await page.getByLabel(/due date/i).fill('2026-12-31');await page.getByRole('button',{name:/submit request/i}).click();await expect(page).toHaveURL(/\/borrow\//);await page.getByRole('button',{name:/approve/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await page.getByRole('button',{name:/issue/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await page.getByRole('button',{name:/return/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await expect(page.getByTestId('table-borrows').getByText('Returned').first()).toBeVisible();
  });

  test('repair creation, diagnosis and completion update asset outcome',async({page})=>{
    await page.goto('/repairs');await page.getByRole('button',{name:/report repair/i}).click();await page.getByLabel(/issue description/i).fill('Acceptance display fault');await page.getByLabel(/technician/i).fill('Naomi Williams');await page.getByLabel(/due date/i).fill('2026-12-31');await page.getByRole('button',{name:/create repair/i}).click();const repairRow=page.getByTestId('table-repairs').getByRole('row').filter({hasText:'Acceptance display fault'});await repairRow.click();await page.getByLabel(/diagnosis/i).fill('Cable replaced');await page.getByRole('button',{name:/save progress/i}).click();await page.getByRole('button',{name:/complete repair/i}).click();await page.getByLabel(/repair outcome/i).fill('Passed functional test');await page.getByRole('button',{name:/complete and update asset/i}).click();await expect(repairRow).toContainText(/Completed/i);
  });

  test('maintenance schedule and completion calculate next date',async({page})=>{
    await page.goto('/maintenance');await page.getByRole('button',{name:/add schedule/i}).click();await page.getByLabel(/maintenance type/i).fill('Acceptance inspection');await page.getByLabel(/first date/i).fill('2026-12-01');await page.getByLabel(/assigned employee/i).fill('Naomi');await page.getByLabel(/checklist/i).fill('Inspect,Clean,Test');await page.getByRole('button',{name:/save schedule/i}).click();await page.getByTestId('table-maintenance').getByRole('row').filter({hasText:'Acceptance inspection'}).click();await page.getByRole('button',{name:/complete maintenance/i}).click();await page.getByRole('button',{name:/complete$/i}).click();await expect(page.getByRole('status').first()).toContainText(/next date/i);
  });

  test('movement and audit records are created through domain pages',async({page})=>{
    await page.goto('/movements/new');await page.getByLabel(/description/i).fill('Acceptance movement');await page.getByLabel(/source/i).fill('ICT Store');await page.getByLabel(/destination/i).fill('Classroom 12');await page.getByLabel(/reason/i).fill('Acceptance verification');await page.getByRole('button',{name:/save movement/i}).click();await expect(page.getByTestId('table-movements').getByRole('row').filter({hasText:'Acceptance movement'})).toBeVisible();
    await page.goto('/audits/new');await page.getByLabel(/^Name/i).fill('Acceptance audit');await page.getByLabel(/assigned auditors/i).fill('Alex Auditor');await page.getByLabel(/deadline/i).fill('2026-12-31');await page.getByRole('button',{name:/generate frozen list/i}).click();await expect(page).toHaveURL(/\/audits\//);await page.getByLabel(/scanned QR/i).fill('KCSMD-147');await page.getByRole('button',{name:/record result/i}).click();await expect(page.getByRole('status')).toContainText(/recorded/i);
  });

  test('disposal requires approval, method and completion',async({page})=>{
    await page.goto('/disposals/dsp-0001');await page.getByRole('button',{name:/approve/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await page.getByLabel(/disposal method/i).selectOption('Recycling');await page.getByRole('button',{name:/method/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await page.getByRole('button',{name:/complete/i}).click();await page.getByRole('button',{name:/confirm/i}).click();await expect(page.getByLabel('dsp-0001',{exact:true}).getByText('Completed',{exact:true}).first()).toBeVisible();
  });

  test('reports, users, roles and notifications expose working primary actions',async({page})=>{
    await page.goto('/reports');await openFirstRecord(page);await page.getByRole('button',{name:/generate/i}).click();await expect(page.getByRole('status')).toContainText(/generated/i);
    await page.goto('/users');await page.getByRole('button',{name:/add user/i}).click();await page.getByLabel(/^Name/i).fill('Acceptance User');await page.getByLabel(/e-?mail/i).fill('acceptance@kcs.edu');await page.getByLabel(/department/i).fill('ICT');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Acceptance User').first()).toBeVisible();
    await page.goto('/roles');await page.getByRole('button',{name:/create role/i}).click();await page.getByLabel(/role name/i).fill('Acceptance Role');await page.getByRole('button',{name:/save role/i}).click();await expect(page.getByText('Acceptance Role').first()).toBeVisible();
    await page.goto('/notifications');await page.getByRole('button',{name:/mark all read/i}).click();await expect(page.getByText('Unread')).toHaveCount(0);
  });

  test('all themes, Dutch switching and permission denial work',async({page})=>{
    await page.goto('/settings');await page.getByRole('button',{name:/Themes/i}).click();for(const [name,id] of [['KCS Forest Gold','kcs-forest-gold'],['KCS Azure Intelligence','kcs-azure-intelligence']]){await page.getByRole('button',{name:new RegExp(name)}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',id)}
    await page.getByRole('button',{name:'Language'}).click();await page.getByLabel('Language').selectOption('nl');await expect(page.getByRole('link',{name:'ICT-middelen'})).toBeVisible();await page.reload();await expect(page.getByRole('link',{name:'ICT-middelen'})).toBeVisible();
    await page.evaluate(()=>{localStorage.setItem('kcs-auth','in');localStorage.setItem('kcs-role','auditor');localStorage.setItem('kcs-language','en')});await page.reload();await page.goto('/users');await expect(page).toHaveURL(/\/403$/);
  });

  test('semantic accessibility, focus and console health pass representative routes',async({page})=>{
    const errors:string[]=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    for(const path of ['/dashboard','/assets','/inventory','/assignments','/borrow','/repairs','/maintenance','/movements','/audits','/disposals','/reports','/users','/roles','/settings']){await page.goto(path);await expect(page.getByRole('main')).toBeVisible();await expect(page.getByRole('heading',{level:1})).toBeVisible();expect(await page.locator('button').evaluateAll(buttons=>buttons.filter(button=>!(button.textContent||'').trim()&&!button.getAttribute('aria-label')&&!button.getAttribute('title')).length)).toBe(0)}
    await page.goto('/dashboard');await page.keyboard.press('Tab');await expect(page.locator(':focus')).toHaveClass(/skip-link/);expect(errors).toEqual([]);
  });
});
