import {describe,expect,it} from 'vitest';
import {MockInventoryRepository} from '../data/mockRepository';
import {authorizedReportFields,csvCell,dataQualityIndicators,nextScheduledRun,notificationKey,protectSpreadsheetCell,rate,reportFileName,riskSeverity,validReportDateRange,validateReportDefinition} from './rules';

describe('Wave 7 report and export rules',()=>{
  it('validates report definitions and date ranges',()=>{
    expect(validateReportDefinition({name:'Asset summary',category:'Assets',columns:['code'],dateRange:{from:'2026-07-01',to:'2026-07-31'}})).toBe(true);
    expect(validReportDateRange('2026-08-01','2026-07-31')).toBe(false);
    expect(validateReportDefinition({name:'',category:'Assets',columns:['code']})).toBe(false);
  });
  it('filters report fields by authorization',()=>{
    expect(authorizedReportFields(['code','name','purchasePrice'],['code','name'])).toEqual(['code','name']);
  });
  it('quotes CSV values and prevents formula injection',()=>{
    expect(csvCell('KCSMD-147')).toBe('KCSMD-147');
    expect(csvCell('Laptop, 14"')).toBe('"Laptop, 14"""');
    expect(protectSpreadsheetCell('=2+2')).toBe("'=2+2");
    expect(csvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
  });
  it('creates stable sanitized export names',()=>{
    expect(reportFileName('Monthly Inventory Report','CSV','2026-07-31')).toBe('monthly-inventory-report-2026-07-31.csv');
  });
});

describe('Wave 7 schedules, notifications and intelligence',()=>{
  it.each([
    ['Daily','2026-08-01'],['Weekly','2026-08-07'],['Monthly','2026-08-31'],['Quarterly','2026-10-31'],['Annual','2027-07-31']
  ] as const)('calculates the next %s run', (recurrence,expected)=>{
    expect(nextScheduledRun('2026-07-31',recurrence)).toBe(expected);
  });
  it('builds a deterministic notification deduplication key',()=>{
    expect(notificationKey('event-1','role:management','Risk','ast-1')).toBe('event-1|role:management|Risk|ast-1');
  });
  it('calculates rates without division errors',()=>{
    expect(rate(3,4)).toBe(75);
    expect(rate(1,0)).toBe(0);
  });
  it('classifies management risk severity',()=>{
    expect(riskSeverity(10)).toBe('Informational');
    expect(riskSeverity(65)).toBe('High');
    expect(riskSeverity(90)).toBe('Critical');
  });
  it('maps asset data-quality indicators',()=>{
    const repository=new MockInventoryRepository();
    const indicators=dataQualityIndicators(repository.snapshot().assets);
    expect(indicators.missingQr).toBeGreaterThanOrEqual(1);
    expect(indicators).toHaveProperty('missingResponsible');
  });
});

describe('Wave 7 repository workflows',()=>{
  it('generates a mock report result with freshness and warning metadata',async()=>{
    const repository=new MockInventoryRepository();
    const definition=repository.snapshot().reports[0];
    const result=await repository.execute({action:'report.generate',entityId:definition.id});
    expect(result.ok).toBe(true);
    expect(repository.snapshot().reportResults[0]).toMatchObject({definitionId:definition.id,status:'Completed with Warnings'});
    expect(repository.snapshot().reportResults[0].snapshotAt).toBeTruthy();
  });
  it('rejects scheduled reports without recipients',async()=>{
    const repository=new MockInventoryRepository();
    const result=await repository.execute({action:'report.schedule.create',values:{name:'Monthly report',recurrence:'Monthly'}});
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/recipient/i);
  });
  it('deduplicates notifications and supports read state',async()=>{
    const repository=new MockInventoryRepository();
    const values={sourceEventId:'evt-wave7',recipient:'current-user',type:'Report',relatedId:'result-1',title:'Report complete'};
    const created=await repository.execute({action:'notification.create',values});
    expect(created.ok).toBe(true);
    expect((await repository.execute({action:'notification.create',values})).ok).toBe(false);
    expect((await repository.execute({action:'notification.read',entityId:created.entityId})).ok).toBe(true);
    expect(repository.snapshot().notifications.find(item=>item.id===created.entityId)?.read).toBe(true);
  });
});
