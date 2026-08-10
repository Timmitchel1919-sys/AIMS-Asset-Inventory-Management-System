import {describe,expect,it} from 'vitest';
import {ASSET_STATUS_DEFINITIONS,assetStatusDefinition,isValidStatusCondition,normalizeAssetStatus} from './assetStatus';
describe('permanent asset status standard',()=>{
  it.each([
    ['available','Good','green'],['assigned','Good','purple'],['borrowed','Good','yellow'],['reserved','Good','blue'],['underMaintenance','Fair','orange'],['underRepair','Good','magenta'],['damaged','Poor','red'],['archived','Good','slate gray']
  ] as const)('%s has its permanent condition and semantic color',(key,condition,color)=>{expect(ASSET_STATUS_DEFINITIONS[key]).toMatchObject({condition,color})});
  it('normalizes known variants and keeps unknown values reportable',()=>{expect(normalizeAssetStatus('AVAILABLE')).toBe('available');expect(normalizeAssetStatus('maintenance')).toBe('underMaintenance');expect(assetStatusDefinition('custom')).toBeUndefined()});
  it('blocks invalid mapped combinations',()=>{expect(isValidStatusCondition('Damaged','Good')).toBe(false);expect(isValidStatusCondition('Damaged','Poor')).toBe(true)});
  it('keeps canonical keys stable',()=>expect(Object.keys(ASSET_STATUS_DEFINITIONS)).toEqual(['available','assigned','borrowed','reserved','underMaintenance','underRepair','damaged','archived']));
});
