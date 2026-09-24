import{describe,expect,it}from'vitest';
import{allocateAssetCodeNumber,compareAssetCodes,normalizeAssetCode}from'./assetCode';
describe('normalizeAssetCode',()=>{it.each([['KCSMD01','KCSMD-01'],['kcsmd 001','KCSMD-01'],['KCSL-125','KCSL-125'],['KCSBD 5000','KCSBD-5000'],['KHL-01','KHL-01'],['KCSL-10001','KCSL-10001']])('normalizes %s', (input,expected)=>expect(normalizeAssetCode(input)?.fullAssetCode).toBe(expected));it('code groups are unlimited: a code above the old 5000 cap is valid',()=>expect(normalizeAssetCode('KCSMD-5001')).not.toBeNull());it.each(['KCSMD-0','K-01','KCSL-ABC'])('rejects %s',input=>expect(normalizeAssetCode(input)).toBeNull())});
describe('compareAssetCodes',()=>{
 it('sorts numeric sequences instead of lexicographic text',()=>expect(['KCSMD-100','KCSMD-2','KCSMD-10'].sort((a,b)=>compareAssetCodes({code:a},{code:b}))).toEqual(['KCSMD-2','KCSMD-10','KCSMD-100']));
 it('supports sequence-only sorting with a prefix tie-break',()=>expect(compareAssetCodes({code:'KCSL-9'},{code:'KCSMD-10'},'sequence')).toBeLessThan(0));
 it('places invalid legacy values after valid codes',()=>expect(compareAssetCodes({code:'legacy'},{code:'KCSMD-2'})).toBeGreaterThan(0));
});
describe('allocateAssetCodeNumber',()=>{
 // maximumNumber is intentionally absent from the group shape used here —
 // code groups are unlimited, and a stored maximumNumber (even an old 5000
 // from before this policy) must never be treated as a real ceiling.
 const group={minimumNumber:1,nextAvailableNumber:31};
 it('TEST 1: allocates the next never-used number, not the lowest free one',()=>{
  // KCSDB-01..30 have all existed at some point; 03 was later disposed and
  // is no longer active, but it must never come back.
  const existing=[{codePrefix:'KCSDB',codeNumber:1},{codePrefix:'KCSDB',codeNumber:2},{codePrefix:'KCSDB',codeNumber:4},{codePrefix:'KCSDB',codeNumber:5}];
  expect(allocateAssetCodeNumber(group,existing,'KCSDB')).toEqual({number:31});
 });
 it('TEST 3/self-healing: derives the floor from real asset history even if the counter drifted behind it',()=>{
  const staleGroup={minimumNumber:1,nextAvailableNumber:5};
  const existing=[{codePrefix:'KCSDB',codeNumber:30}];
  expect(allocateAssetCodeNumber(staleGroup,existing,'KCSDB')).toEqual({number:31});
 });
 it('ignores other prefixes when computing the floor (KCSDB-30 and KCSL-30 are independent)',()=>{
  const existing=[{codePrefix:'KCSL',codeNumber:900}];
  expect(allocateAssetCodeNumber(group,existing,'KCSDB')).toEqual({number:31});
 });
 it('TEST 4: rejects an explicit request to reuse a number that has already been used',()=>{
  const existing=[{codePrefix:'KCSDB',codeNumber:30}];
  expect(allocateAssetCodeNumber(group,existing,'KCSDB',30)).toEqual({error:'already-used'});
 });
 it('accepts an explicit request for a genuinely new, never-used number',()=>{
  const existing=[{codePrefix:'KCSDB',codeNumber:30}];
  expect(allocateAssetCodeNumber(group,existing,'KCSDB',31)).toEqual({number:31});
 });
 it('TEST 8: unlimited — a code group already at 5000 keeps allocating past it, ignoring a stale stored maximumNumber',()=>{
  const legacyGroup={minimumNumber:1,maximumNumber:5000,nextAvailableNumber:5001};
  expect(allocateAssetCodeNumber(legacyGroup,[],'KCSL')).toEqual({number:5001});
  const existing=[{codePrefix:'KCSL',codeNumber:10000}];
  expect(allocateAssetCodeNumber(legacyGroup,existing,'KCSL')).toEqual({number:10001});
 });
});
