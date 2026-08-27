import type { AssetStatus } from "./types";
export type AssetStatusKey="available"|"assigned"|"borrowed"|"reserved"|"underMaintenance"|"underRepair"|"damaged"|"archived";
export type AssetStatusIcon="circleCheck"|"arrowUpRight"|"arrowLeftRight"|"clock"|"cog"|"wrench"|"alert"|"packageClosed";
export interface AssetStatusDefinition{key:AssetStatusKey;status:AssetStatus;color:string;colorToken:string;translationKey:string;icon:AssetStatusIcon}
export const ASSET_STATUS_DEFINITIONS:Record<AssetStatusKey,AssetStatusDefinition>={
 available:{key:"available",status:"Available",color:"#0D9488",colorToken:"asset-status-available",translationKey:"status.Available",icon:"circleCheck"},
 assigned:{key:"assigned",status:"Assigned",color:"#7C3AED",colorToken:"asset-status-assigned",translationKey:"status.Assigned",icon:"arrowUpRight"},
 borrowed:{key:"borrowed",status:"Borrowed",color:"#EAB308",colorToken:"asset-status-borrowed",translationKey:"status.Borrowed",icon:"arrowLeftRight"},
 reserved:{key:"reserved",status:"Reserved",color:"#2563EB",colorToken:"asset-status-reserved",translationKey:"status.Reserved",icon:"clock"},
 underMaintenance:{key:"underMaintenance",status:"Under Maintenance",color:"#D97706",colorToken:"asset-status-under-maintenance",translationKey:"status.Under Maintenance",icon:"cog"},
 underRepair:{key:"underRepair",status:"Under Repair",color:"#DB2777",colorToken:"asset-status-under-repair",translationKey:"status.Under Repair",icon:"wrench"},
 damaged:{key:"damaged",status:"Damaged",color:"#B91C1C",colorToken:"asset-status-damaged",translationKey:"status.Damaged",icon:"alert"},
 archived:{key:"archived",status:"Archived",color:"#64748B",colorToken:"asset-status-archived",translationKey:"status.Archived",icon:"packageClosed"}
};
const aliases:Record<string,AssetStatusKey>={available:"available",beschikbaar:"available","in-stock":"available",assigned:"assigned",toegewezen:"assigned",allocated:"assigned","issued to employee":"assigned","assigned-to-user":"assigned",borrowed:"borrowed",geleend:"borrowed",reserved:"reserved",gereserveerd:"reserved","under maintenance":"underMaintenance",maintenance:"underMaintenance",undermaintenance:"underMaintenance",in_maintenance:"underMaintenance","in onderhoud":"underMaintenance","under repair":"underRepair","under-repair":"underRepair",under_repair:"underRepair","in repair":"underRepair",repair:"underRepair","in reparatie":"underRepair",damaged:"damaged",beschadigd:"damaged",archived:"archived",gearchiveerd:"archived","inactive archive":"archived",historical:"archived","retired record":"archived"};
export function normalizeAssetStatus(value:string){return aliases[value.trim().toLowerCase()]}
export function assetStatusDefinition(value:string){const key=normalizeAssetStatus(value);return key?ASSET_STATUS_DEFINITIONS[key]:undefined}
export interface AssetStatusNormalizationRow{original:string;canonical?:AssetStatusKey;count:number;manualReview:boolean}
export function assetStatusNormalizationReport(values:string[]):AssetStatusNormalizationRow[]{const counts=new Map<string,number>();values.forEach(value=>counts.set(value,(counts.get(value)||0)+1));return[...counts].map(([original,count])=>{const canonical=normalizeAssetStatus(original);return{original,canonical,count,manualReview:!canonical}}).sort((a,b)=>a.original.localeCompare(b.original))}
