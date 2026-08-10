import type {AssetStatus,Condition} from './types';
export type AssetStatusKey='available'|'assigned'|'borrowed'|'reserved'|'underMaintenance'|'underRepair'|'damaged'|'archived';
export type AssetConditionKey='good'|'fair'|'poor';
export type AssetStatusColor='green'|'purple'|'yellow'|'blue'|'orange'|'magenta'|'red'|'slate gray';
export interface AssetStatusDefinition{key:AssetStatusKey;status:AssetStatus;conditionKey:AssetConditionKey;condition:Condition;color:AssetStatusColor;colorToken:string;translationKey:string;conditionTranslationKey:string;icon:'check'|'userCheck'|'hand'|'bookmark'|'wrench'|'tool'|'alert'|'archive'}
export const ASSET_STATUS_DEFINITIONS:Record<AssetStatusKey,AssetStatusDefinition>={
  available:{key:'available',status:'Available',conditionKey:'good',condition:'Good',color:'green',colorToken:'asset-status-available',translationKey:'status.Available',conditionTranslationKey:'condition.Good',icon:'check'},
  assigned:{key:'assigned',status:'Assigned',conditionKey:'good',condition:'Good',color:'purple',colorToken:'asset-status-assigned',translationKey:'status.Assigned',conditionTranslationKey:'condition.Good',icon:'userCheck'},
  borrowed:{key:'borrowed',status:'Borrowed',conditionKey:'good',condition:'Good',color:'yellow',colorToken:'asset-status-borrowed',translationKey:'status.Borrowed',conditionTranslationKey:'condition.Good',icon:'hand'},
  reserved:{key:'reserved',status:'Reserved',conditionKey:'good',condition:'Good',color:'blue',colorToken:'asset-status-reserved',translationKey:'status.Reserved',conditionTranslationKey:'condition.Good',icon:'bookmark'},
  underMaintenance:{key:'underMaintenance',status:'Under Maintenance',conditionKey:'fair',condition:'Fair',color:'orange',colorToken:'asset-status-under-maintenance',translationKey:'status.Under Maintenance',conditionTranslationKey:'condition.Fair',icon:'wrench'},
  underRepair:{key:'underRepair',status:'Under Repair',conditionKey:'good',condition:'Good',color:'magenta',colorToken:'asset-status-under-repair',translationKey:'status.Under Repair',conditionTranslationKey:'condition.Good',icon:'tool'},
  damaged:{key:'damaged',status:'Damaged',conditionKey:'poor',condition:'Poor',color:'red',colorToken:'asset-status-damaged',translationKey:'status.Damaged',conditionTranslationKey:'condition.Poor',icon:'alert'}
  ,archived:{key:'archived',status:'Archived',conditionKey:'good',condition:'Good',color:'slate gray',colorToken:'asset-status-archived',translationKey:'status.Archived',conditionTranslationKey:'condition.Good',icon:'archive'}
};
const aliases:Record<string,AssetStatusKey>={'available':'available','in-stock':'available','assigned':'assigned','allocated':'assigned','issued to employee':'assigned','assigned-to-user':'assigned','borrowed':'borrowed','reserved':'reserved','under maintenance':'underMaintenance','maintenance':'underMaintenance','undermaintenance':'underMaintenance','under repair':'underRepair','under-repair':'underRepair','under_repair':'underRepair','in repair':'underRepair','repair':'underRepair','damaged':'damaged','archived':'archived','inactive archive':'archived','historical':'archived','retired record':'archived'};
export function normalizeAssetStatus(value:string){return aliases[value.trim().toLowerCase()]}
export function assetStatusDefinition(value:string){const key=normalizeAssetStatus(value);return key?ASSET_STATUS_DEFINITIONS[key]:undefined}
export function mappedCondition(value:string){return assetStatusDefinition(value)?.condition}
export function isValidStatusCondition(status:string,condition:string){const mapped=mappedCondition(status);return !mapped||mapped===condition}
export interface AssetStatusNormalizationRow{original:string;canonical?:AssetStatusKey;count:number;manualReview:boolean}
export function assetStatusNormalizationReport(values:string[]):AssetStatusNormalizationRow[]{const counts=new Map<string,number>();values.forEach(value=>counts.set(value,(counts.get(value)||0)+1));return[...counts].map(([original,count])=>{const canonical=normalizeAssetStatus(original);return{original,canonical,count,manualReview:!canonical}}).sort((a,b)=>a.original.localeCompare(b.original))}
