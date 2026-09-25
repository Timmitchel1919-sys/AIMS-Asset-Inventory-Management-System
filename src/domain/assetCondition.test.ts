import{describe,expect,it}from"vitest";
import{ASSET_CONDITIONS,ASSET_CONDITION_DEFINITIONS,assetConditionDefinition,knownAssetCondition,normalizeAssetCondition}from"./assetCondition";
describe("KCS condition standard",()=>{it.each([["good","#22C55E"],["fair","#F97316"],["poor","#DC2626"]]as const)("%s keeps its fixed color",(key,color)=>expect(ASSET_CONDITION_DEFINITIONS[key].color).toBe(color));it("normalizes English and Dutch without changing unknown values",()=>{expect(normalizeAssetCondition("GOED")).toBe("good");expect(normalizeAssetCondition("Redelijk")).toBe("fair");expect(assetConditionDefinition("custom")).toBeUndefined()})});
describe("migration condition values",()=>{
 it("lists Bad, Use for parts, Out of service and Unknown exactly once",()=>{for(const value of["Bad","Use for parts","Out of service","Unknown"])expect(ASSET_CONDITIONS.filter(c=>c.toLowerCase()===value.toLowerCase())).toHaveLength(1);expect(new Set(ASSET_CONDITIONS.map(c=>c.toLowerCase())).size).toBe(ASSET_CONDITIONS.length)});
 it("matches legacy spellings case- and space-insensitively",()=>{expect(knownAssetCondition(" USE FOR PARTS ")).toBe("Use for parts");expect(knownAssetCondition("GOOD")).toBe("Good");expect(knownAssetCondition("DEFFECT")).toBeUndefined();expect(knownAssetCondition("50%")).toBeUndefined()});
 it("colors the new damage values red and leaves Unknown neutral",()=>{expect(normalizeAssetCondition("Out of service")).toBe("poor");expect(normalizeAssetCondition("Use for parts")).toBe("poor");expect(assetConditionDefinition("Unknown")).toBeUndefined()});
});
