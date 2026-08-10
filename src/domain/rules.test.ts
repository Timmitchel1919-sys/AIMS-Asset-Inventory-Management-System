import{describe,expect,it}from'vitest';
import{applyStockDelta,availableStock,canBorrow,canTransitionAsset,canTransitionDisposal,canTransitionRepair,compareAssetCodes,composeAssetFilters,deterministicAuditSample,isOverdue,nextMaintenanceDate,normalizeTheme}from'./rules';
import{assets,borrows}from'../data/mock';

describe('domain rules',()=>{
  it('sorts KCS codes numerically within prefixes',()=>{const values=[...assets].sort(compareAssetCodes).filter(a=>a.codePrefix==='KCSMD').map(a=>a.codeNumber);expect(values).toEqual([...values].sort((a,b)=>a-b));expect(values.slice(0,2)).toEqual([147,151])});
  it('composes simultaneous filters',()=>expect(assets.filter(composeAssetFilters({status:'Available',category:'Printers',query:'HP'})).map(a=>a.id)).toEqual(['ast-002']));
  it('validates asset transitions',()=>{expect(canTransitionAsset('Available','Borrowed')).toBe(true);expect(canTransitionAsset('Disposed','Borrowed')).toBe(false)});
  it('calculates available stock',()=>expect(availableStock({onHand:10,reserved:3})).toBe(7));
  it('prevents negative stock',()=>expect(()=>applyStockDelta(2,-3)).toThrow('negative'));
  it('allows borrowing only available assets',()=>{expect(canBorrow({status:'Available'})).toBe(true);expect(canBorrow({status:'Assigned'})).toBe(false)});
  it('detects overdue records and excludes returns',()=>{expect(isOverdue(borrows[0],'2026-07-30')).toBe(true);expect(isOverdue({...borrows[0],status:'Returned'},'2026-07-30')).toBe(false)});
  it('validates repair status order',()=>{expect(canTransitionRepair('Reported','Diagnosing')).toBe(true);expect(canTransitionRepair('Reported','Completed')).toBe(false)});
  it('calculates recurring maintenance dates',()=>{expect(nextMaintenanceDate('2026-01-31','Monthly')).toBe('2026-03-03');expect(nextMaintenanceDate('2026-01-01','Weekly')).toBe('2026-01-08')});
  it('creates deterministic audit samples with recent exclusions',()=>expect(deterministicAuditSample(assets,2,['ast-001']).map(a=>a.id)).toEqual(['ast-002','ast-003']));
  it('enforces disposal sequence',()=>{expect(canTransitionDisposal('Inspected','Approved')).toBe(true);expect(canTransitionDisposal('Approved','Method Selected')).toBe(true);expect(canTransitionDisposal('Requested','Completed')).toBe(false)});
  it('falls back to AIMS Azure Glass for invalid themes',()=>expect(normalizeTheme('unknown')).toBe('aimsAzureGlass'));
  it('falls back when the removed KCS Azure Flow key is encountered',()=>expect(normalizeTheme('kcsAzureFlow')).toBe('aimsAzureGlass'));
  it('migrates supported legacy themes',()=>{expect(normalizeTheme('kcs-forest-gold')).toBe('aimsEmeraldGlass');expect(normalizeTheme('kcs-azure-intelligence')).toBe('aimsAzureGlass')});
});
