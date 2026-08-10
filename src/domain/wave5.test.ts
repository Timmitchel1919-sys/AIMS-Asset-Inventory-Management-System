import {describe,expect,it} from 'vitest';
import {canTransitionMaintenance,canTransitionRepair,correctionQuantity,maintenanceDaysOverdue,validMaintenanceSchedule,validMovement} from './rules';
import {MockInventoryRepository} from '../data/mockRepository';

describe('Wave 5 repair rules',()=>{
  it('supports the controlled diagnosis and approval lifecycle',()=>{
    expect(canTransitionRepair('Reported','Diagnosing')).toBe(true);
    expect(canTransitionRepair('Diagnosing','Awaiting Approval')).toBe(true);
    expect(canTransitionRepair('Awaiting Approval','Approved')).toBe(true);
  });
  it('blocks rejected and returned repairs from silently reopening',()=>{
    expect(canTransitionRepair('Rejected','In Repair')).toBe(false);
    expect(canTransitionRepair('Returned to User','In Repair')).toBe(false);
  });
  it('supports external repair and testing outcomes',()=>{
    expect(canTransitionRepair('Approved','External Repair')).toBe(true);
    expect(canTransitionRepair('External Repair','Testing')).toBe(true);
    expect(canTransitionRepair('Testing','In Repair')).toBe(true);
  });
});

describe('Wave 5 maintenance rules',()=>{
  it.each(['Weekly','Monthly','Quarterly','Every six months','Annual'])('accepts a %s schedule',frequency=>{
    expect(validMaintenanceSchedule('2026-08-01',frequency)).toBe(true);
  });
  it('requires a positive custom interval',()=>{
    expect(validMaintenanceSchedule('2026-08-01','Custom interval',0)).toBe(false);
    expect(validMaintenanceSchedule('2026-08-01','Custom interval',45)).toBe(true);
  });
  it('enforces task transitions and immutable completion',()=>{
    expect(canTransitionMaintenance('Scheduled','In Progress')).toBe(true);
    expect(canTransitionMaintenance('In Progress','Completed')).toBe(true);
    expect(canTransitionMaintenance('Completed','In Progress')).toBe(false);
  });
  it('calculates overdue days without negative results',()=>{
    expect(maintenanceDaysOverdue('2026-07-20',new Date('2026-07-30T12:00:00Z'))).toBe(10);
    expect(maintenanceDaysOverdue('2026-08-20',new Date('2026-07-30T12:00:00Z'))).toBe(0);
  });
});

describe('Wave 5 movement rules',()=>{
  it('requires positive quantity and distinct locations',()=>{
    expect(validMovement(1,'ICT Store','Classroom 1')).toBe(true);
    expect(validMovement(0,'ICT Store','Classroom 1')).toBe(false);
    expect(validMovement(1,'ICT Store','ICT Store')).toBe(false);
  });
  it('calculates compensating quantity impact',()=>{
    expect(correctionQuantity(12,5,2)).toBe(9);
    expect(correctionQuantity(12,5,5)).toBe(12);
  });
});

describe('Wave 5 repository lifecycle',()=>{
  it('creates and completes a repair while synchronizing the asset',async()=>{
    const repository=new MockInventoryRepository();
    const asset=repository.snapshot().assets.find(item=>item.status==='Available')!;
    const created=await repository.execute({action:'repair.create',entityId:asset.id,values:{issue:'Display fault',due:'2026-12-31'}});
    expect(created.ok).toBe(true);
    const completed=await repository.execute({action:'repair.complete',entityId:created.entityId,values:{outcome:'Passed',assetStatus:'Available',condition:'Good'}});
    expect(completed).toMatchObject({ok:true});
    expect(repository.snapshot().repairs.find(item=>item.id===created.entityId)?.status).toBe('Completed');
    expect(repository.snapshot().assets.find(item=>item.id===asset.id)?.status).toBe('Available');
  });
});
