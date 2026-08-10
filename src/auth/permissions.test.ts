import{describe,expect,it}from'vitest';import{can}from'./permissions';
describe('permission checks',()=>{it('allows administrators',()=>expect(can('administrator','roles.manage')).toBe(true));it('blocks auditors from mutations',()=>expect(can('auditor','assets.edit')).toBe(false));it('allows auditors to view activity',()=>expect(can('auditor','activity.view')).toBe(true))});

