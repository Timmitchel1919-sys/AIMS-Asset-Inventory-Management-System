import type{Condition}from"./types";
/** Every selectable asset condition, in dropdown order. The single source for forms, filters and validation. */
export const ASSET_CONDITIONS=["New","Excellent","Good","Fair","Poor","Bad","Defective","Out of service","Use for parts","Beyond Repair","Unknown"] as const satisfies readonly Condition[];
export type AssetConditionKey="good"|"fair"|"poor";
export interface AssetConditionDefinition{key:AssetConditionKey;condition:string;color:string;colorToken:string;translationKey:string}
export const ASSET_CONDITION_DEFINITIONS:Record<AssetConditionKey,AssetConditionDefinition>={
 good:{key:"good",condition:"Good",color:"#22C55E",colorToken:"asset-condition-good",translationKey:"condition.Good"},
 fair:{key:"fair",condition:"Fair",color:"#F97316",colorToken:"asset-condition-fair",translationKey:"condition.Fair"},
 poor:{key:"poor",condition:"Poor",color:"#DC2626",colorToken:"asset-condition-poor",translationKey:"condition.Poor"}
};
const aliases:Record<string,AssetConditionKey>={good:"good",goed:"good",excellent:"good",uitstekend:"good",new:"good",nieuw:"good",fair:"fair",redelijk:"fair",poor:"poor",bad:"poor",slecht:"poor",defective:"poor",defect:"poor","beyond repair":"poor",onherstelbaar:"poor","use for parts":"poor","out of service":"poor","buiten gebruik":"poor"};
export function normalizeAssetCondition(value:string){return aliases[value.trim().toLowerCase()]}
export function assetConditionDefinition(value:string){const key=normalizeAssetCondition(value);return key?ASSET_CONDITION_DEFINITIONS[key]:undefined}
/** The exact listed condition matching `value` (case/space-insensitive), if any. */
export function knownAssetCondition(value:string):Condition|undefined{const v=value.trim().toLowerCase();return ASSET_CONDITIONS.find(c=>c.toLowerCase()===v)}
