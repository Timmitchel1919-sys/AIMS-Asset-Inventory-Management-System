import{describe,expect,it}from'vitest';
import{rolePermissions}from'../auth/permissions';
import{MockInventoryRepository}from'../data/mockRepository';
import{canChangeAdministrator,classifyAiIntent,DeterministicMockAiProvider,effectivePermissions}from'./wave8';
describe('Wave 8 access and assistant boundaries',()=>{
  it('applies explicit denials after role permissions and grants',()=>expect(effectivePermissions(['assets.view'],['inventory.view'],['assets.view'])).toEqual(['inventory.view']));
  it('protects the last active administrator',()=>expect(canChangeAdministrator([{role:'Administrator',status:'Active'}],{role:'Administrator',status:'Active'})).toBe(false));
  it('classifies mutation language before informational intents',()=>expect(classifyAiIntent('Assign an available laptop')).toBe('mutation'));
  it('blocks mutations without changing repository state',async()=>{const repo=new MockInventoryRepository(),before=JSON.stringify(repo.snapshot());const response=await new DeterministicMockAiProvider().query({query:'Delete an asset',language:'en',permissions:rolePermissions.administrator,snapshot:repo.snapshot()});expect(response.blocked).toBe(true);expect(JSON.stringify(repo.snapshot())).toBe(before)});
  it('filters an inventory answer when inventory permission is absent',async()=>{const repo=new MockInventoryRepository();const response=await new DeterministicMockAiProvider().query({query:'Show low stock',language:'en',permissions:['assets.view'],snapshot:repo.snapshot()});expect(response.blocked).toBe(true);expect(response.citations).toEqual([])});
  it('returns only valid mock record references',async()=>{const repo=new MockInventoryRepository();const response=await new DeterministicMockAiProvider().query({query:'Show low stock',language:'en',permissions:['inventory.view'],snapshot:repo.snapshot()});expect(response.citations.every(c=>repo.snapshot().inventory.some(item=>item.id===c.id))).toBe(true)});
});
