import {beforeEach,describe,expect,it} from 'vitest';
import {MockInventoryRepository} from './mockRepository';
describe('permanent extended asset status workflows',()=>{
  let repository:MockInventoryRepository;
  beforeEach(()=>repository=new MockInventoryRepository());
  it('starts an assignment without overwriting physical condition',async()=>{const asset=repository.snapshot().assets.find(item=>item.status==='Available')!,condition=asset.condition;const result=await repository.execute({action:'assignment.create',entityId:asset.id,values:{assignee:'Test User'}});expect(result.ok).toBe(true);expect(asset).toMatchObject({status:'Assigned',condition})});
  it('starts a repair while preserving previous status and condition',async()=>{const asset=repository.snapshot().assets.find(item=>item.status==='Available')!;const previous={status:asset.status,condition:asset.condition};const result=await repository.execute({action:'repair.create',entityId:asset.id,values:{issue:'Test fault'}});const repair=repository.snapshot().repairs.find(item=>item.id===result.entityId)!;expect(asset).toMatchObject({status:'Under Repair',condition:previous.condition});expect(repair).toMatchObject({previousAssetStatus:previous.status,previousAssetCondition:previous.condition})});
  it('archives without changing code or physical condition',async()=>{const asset=repository.snapshot().assets.find(item=>item.status==='Available')!,code=asset.code,condition=asset.condition;await repository.execute({action:'asset.archive',entityId:asset.id});expect(asset).toMatchObject({code,status:'Archived',condition})});
});
