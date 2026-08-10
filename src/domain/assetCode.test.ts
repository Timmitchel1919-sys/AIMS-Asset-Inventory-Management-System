import{describe,expect,it}from'vitest';
import{compareAssetCodes,normalizeAssetCode}from'./assetCode';
describe('normalizeAssetCode',()=>{it.each([['KCSMD01','KCSMD-01'],['kcsmd 001','KCSMD-01'],['KCSL-125','KCSL-125'],['KCSBD 5000','KCSBD-5000']])('normalizes %s', (input,expected)=>expect(normalizeAssetCode(input)?.fullAssetCode).toBe(expected));it.each(['KCSMD-0','KCSMD-5001','KCSXYZ-01','KCSL-ABC'])('rejects %s',input=>expect(normalizeAssetCode(input)).toBeNull())});
describe('compareAssetCodes',()=>{
 it('sorts numeric sequences instead of lexicographic text',()=>expect(['KCSMD-100','KCSMD-2','KCSMD-10'].sort((a,b)=>compareAssetCodes({code:a},{code:b}))).toEqual(['KCSMD-2','KCSMD-10','KCSMD-100']));
 it('supports sequence-only sorting with a prefix tie-break',()=>expect(compareAssetCodes({code:'KCSL-9'},{code:'KCSMD-10'},'sequence')).toBeLessThan(0));
 it('places invalid legacy values after valid codes',()=>expect(compareAssetCodes({code:'legacy'},{code:'KCSMD-2'})).toBeGreaterThan(0));
});
