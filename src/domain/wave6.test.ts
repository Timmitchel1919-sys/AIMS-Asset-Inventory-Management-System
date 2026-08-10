import {describe,expect,it} from 'vitest';
import {MockInventoryRepository} from '../data/mockRepository';
import {auditCompletionEligible,auditConfigurationValid,auditProgress,canTransitionAudit,canTransitionCorrectiveAction,classifyQuantityVariance,deterministicAuditSelection,discrepancySeverity,scanAuditItem} from './rules';
import type {Audit,AuditItem} from './types';

const population=Array.from({length:20},(_,index)=>({id:`record-${index+1}`,category:index%2?'A':'B',location:index%3?'North':'South'}));

describe('Wave 6 deterministic audit selection',()=>{
  it('repeats a fixed-count sample for the same seed',()=>{
    const options={seed:'KCS-2026',method:'Fixed count' as const,value:6};
    expect(deterministicAuditSelection(population,options)).toEqual(deterministicAuditSelection(population,options));
  });
  it('varies the sample when the seed changes',()=>{
    expect(deterministicAuditSelection(population,{seed:'A',method:'Fixed count',value:6})).not.toEqual(deterministicAuditSelection(population,{seed:'B',method:'Fixed count',value:6}));
  });
  it('supports percentage and full-audit samples without duplicates',()=>{
    const percentage=deterministicAuditSelection(population,{seed:'P',method:'Percentage',value:25});
    const full=deterministicAuditSelection(population,{seed:'F',method:'Full audit'});
    expect(percentage).toHaveLength(5);
    expect(new Set(full.map(item=>item.id)).size).toBe(20);
  });
  it('applies explicit exclusions and rejects an oversized request',()=>{
    const result=deterministicAuditSelection(population,{seed:'E',method:'Fixed count',value:3,excludedIds:['record-1']});
    expect(result.map(item=>item.id)).not.toContain('record-1');
    expect(()=>deterministicAuditSelection(population,{seed:'X',method:'Fixed count',value:21})).toThrow(/too small/i);
  });
});

describe('Wave 6 audit execution rules',()=>{
  const items:AuditItem[]=[
    {id:'1',recordId:'a',recordType:'asset',code:'KCS-1',name:'A',category:'ICT',location:'Store',department:'ICT',expectedStatus:'Available',result:'Verified'},
    {id:'2',recordId:'b',recordType:'inventory',code:'INV-1',name:'B',category:'Stock',location:'Store',department:'ICT',expectedStatus:'In stock',expectedQuantity:10,countedQuantity:8,variance:-2,result:'Quantity Shortage'}
  ];
  it('validates configuration and deadline order',()=>{
    expect(auditConfigurationValid({deadline:'2026-08-31',auditors:['Naomi'],method:'Percentage',value:20})).toBe(true);
    expect(auditConfigurationValid({start:'2026-09-01',deadline:'2026-08-31',auditors:['Naomi'],method:'Fixed count',value:2})).toBe(false);
  });
  it('enforces audit transitions and closure immutability',()=>{
    expect(canTransitionAudit('Prepared','In Progress')).toBe(true);
    expect(canTransitionAudit('Completed','Closed')).toBe(true);
    expect(canTransitionAudit('Closed','In Progress')).toBe(false);
  });
  it('calculates progress and quantity variance',()=>{
    expect(auditProgress(items)).toMatchObject({reviewed:2,verified:1,discrepancies:1,percentage:100,quantityVariance:-2});
  });
  it('detects matching, mismatched and duplicate scans',()=>{
    expect(scanAuditItem(items,'KCS-1',[])).toBe('match');
    expect(scanAuditItem(items,'OTHER',[])).toBe('mismatch');
    expect(scanAuditItem(items,'KCS-1',['KCS-1'])).toBe('duplicate');
  });
  it('classifies shortages, surpluses and discrepancy severity',()=>{
    expect(classifyQuantityVariance(10,8)).toBe('Quantity Shortage');
    expect(classifyQuantityVariance(10,12)).toBe('Quantity Surplus');
    expect(discrepancySeverity('Missing asset')).toBe('Critical');
  });
  it('requires resolved items for completion',()=>{
    const audit={sampleItems:items,progress:100} as Audit;
    expect(auditCompletionEligible(audit)).toBe(true);
    expect(auditCompletionEligible({...audit,sampleItems:[{...items[0],deferred:true}]})).toBe(false);
  });
  it('enforces corrective-action approval and verification order',()=>{
    expect(canTransitionCorrectiveAction('Pending Approval','Approved')).toBe(true);
    expect(canTransitionCorrectiveAction('Completed','Verified')).toBe(true);
    expect(canTransitionCorrectiveAction('Closed','In Progress')).toBe(false);
  });
});

describe('Wave 6 repository workflow',()=>{
  it('generates, freezes and records a discrepancy without changing stock',async()=>{
    const repository=new MockInventoryRepository();
    const generated=await repository.execute({action:'audit.generate',values:{name:'Seeded audit',count:2,seed:'TEST',assignee:'Auditor',deadline:'2026-12-31'}});
    expect(generated.ok).toBe(true);
    expect((await repository.execute({action:'audit.freeze',entityId:generated.entityId})).ok).toBe(true);
    const audit=repository.snapshot().audits.find(item=>item.id===generated.entityId)!;
    const before=repository.snapshot().inventory.map(item=>item.onHand);
    expect((await repository.execute({action:'audit.discrepancy',entityId:audit.id,values:{scannedCode:audit.sampleItems![0].code,outcome:'Wrong Location'}})).ok).toBe(true);
    expect(repository.snapshot().auditDiscrepancies).toHaveLength(1);
    expect(repository.snapshot().inventory.map(item=>item.onHand)).toEqual(before);
  });
});
