import{describe,expect,it}from'vitest';
import{MockInventoryRepository}from'./mockRepository';
describe('presentation demonstration dataset',()=>{
  it('contains a deterministic, presentation-sized fictional catalog',()=>{
    const first=new MockInventoryRepository().snapshot(),second=new MockInventoryRepository().snapshot();
    expect(first.assets.length).toBeGreaterThanOrEqual(20);
    expect(first.inventory.length).toBeGreaterThanOrEqual(10);
    expect(first.users.length).toBeGreaterThanOrEqual(7);
    expect(second.assets).toEqual(first.assets);
  });
  it('covers asset, stock and operational presentation states',()=>{
    const data=new MockInventoryRepository().snapshot();
    for(const status of ['Available','Assigned','Borrowed','Under Repair','Under Maintenance','Damaged','Archived'])expect(data.assets.some(asset=>asset.status===status)).toBe(true);
    expect(data.inventory.some(item=>item.onHand===0)).toBe(true);
    expect(data.inventory.some(item=>item.onHand-item.reserved<item.minimum)).toBe(true);
    expect(data.borrows.some(item=>item.status==='Overdue')).toBe(true);
    expect(data.repairs.some(item=>item.status==='Waiting for Parts')).toBe(true);
  });
  it('uses unique codes, serials and valid user email addresses',()=>{
    const data=new MockInventoryRepository().snapshot();
    expect(new Set(data.assets.map(asset=>asset.code)).size).toBe(data.assets.length);
    expect(new Set(data.assets.map(asset=>asset.serialNumber)).size).toBe(data.assets.length);
    expect(data.users.every(user=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email))).toBe(true);
  });
  it('restores the exact seed after mutation',async()=>{
    const repo=new MockInventoryRepository(),expected=structuredClone(repo.snapshot());
    await repo.execute({action:'stock.receive',entityId:repo.snapshot().inventory[0].id,values:{quantity:7}});
    repo.reset();
    expect(repo.snapshot()).toEqual(expected);
  });
});
