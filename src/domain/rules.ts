import type {Asset,AssetStatus,Audit,AuditItem,BorrowRecord,CorrectiveAction,Maintenance,Repair,ThemeId} from './types';
import type {DisposalStatus,InventoryItem} from '../data/contracts';
import type {ReportDefinition} from '../data/contracts';
import type {AssignmentStatus,AssignmentAccessory} from '../data/contracts';

export const compareAssetCodes=(a:Pick<Asset,'codePrefix'|'codeNumber'>,b:Pick<Asset,'codePrefix'|'codeNumber'>)=>a.codePrefix.localeCompare(b.codePrefix)||a.codeNumber-b.codeNumber;
export function composeAssetFilters(filters:{status?:string;category?:string;query?:string}){
  return(asset:Asset)=>{const query=filters.query?.trim().toLowerCase();return(!filters.status||asset.status===filters.status)&&(!filters.category||asset.category===filters.category)&&(!query||[asset.code,asset.name,asset.serialNumber,asset.brand,asset.model,asset.location].some(value=>value.toLowerCase().includes(query)))};
}
const assetTransitions:Record<AssetStatus,AssetStatus[]>={
  Available:['Assigned','Borrowed','Under Repair','Under Maintenance','Reserved','Lost','Missing','Damaged','Archived'],
  Assigned:['Available','Under Repair','Under Maintenance','Lost','Missing','Damaged','Archived'],
  Borrowed:['Available','Under Repair','Lost','Missing','Damaged'],
  'Under Repair':['Available','Assigned','Under Maintenance','Damaged','Disposed','Archived'],
  'Under Maintenance':['Available','Assigned','Under Repair','Damaged','Archived'],
  Reserved:['Available','Assigned','Borrowed','Archived'],Lost:['Available','Archived','Disposed'],Missing:['Available','Lost','Archived'],
  Damaged:['Under Repair','Disposed','Archived'],Disposed:['Archived'],Archived:['Available']
};
export const canTransitionAsset=(from:AssetStatus,to:AssetStatus)=>assetTransitions[from].includes(to);
export const availableStock=(item:Pick<InventoryItem,'onHand'|'reserved'>)=>Math.max(0,item.onHand-item.reserved);
export const stockStatus=(item:Pick<InventoryItem,'onHand'|'reserved'|'minimum'|'archived'>)=>item.archived?'Archived':item.onHand===0?'Out of stock':availableStock(item)===0&&item.reserved>0?'Fully reserved':availableStock(item)<=item.minimum?'Low stock':item.reserved>0?'Reserved':'In stock';
export function reserveStock(item:Pick<InventoryItem,'onHand'|'reserved'>,quantity:number){if(quantity<=0)throw new Error('Quantity must be positive.');if(quantity>availableStock(item))throw new Error('Reserved quantity cannot exceed available quantity.');return item.reserved+quantity}
export function releaseStock(reserved:number,quantity:number){if(quantity<=0||quantity>reserved)throw new Error('Release quantity exceeds reserved quantity.');return reserved-quantity}
export function fulfillReservation(onHand:number,reserved:number,quantity:number){if(quantity<=0||quantity>reserved||quantity>onHand)throw new Error('Fulfillment exceeds reserved stock.');return{onHand:onHand-quantity,reserved:reserved-quantity}}
export const isLowStock=(item:Pick<InventoryItem,'onHand'|'reserved'|'minimum'>)=>availableStock(item)>0&&availableStock(item)<=item.minimum;
export const reorderRecommendation=(item:Pick<InventoryItem,'onHand'|'reserved'|'reorderLevel'|'reorderQuantity'|'maximum'>)=>availableStock(item)>item.reorderLevel?0:Math.max(item.reorderQuantity,(item.maximum??item.reorderLevel+item.reorderQuantity)-item.onHand);
export function validateLocationMove(id:string,parentId:string|undefined,records:{id:string;parent?:string}[]){let cursor=parentId;while(cursor){if(cursor===id)return false;cursor=records.find(record=>record.id===cursor)?.parent}return true}
export function applyStockDelta(onHand:number,delta:number){if(!Number.isFinite(delta))throw new Error('Quantity must be numeric.');if(onHand+delta<0)throw new Error('Stock cannot become negative.');return onHand+delta}
export const canBorrow=(asset:Pick<Asset,'status'>)=>asset.status==='Available';
export const isOverdue=(borrow:Pick<BorrowRecord,'status'|'dueDate'>,asOf:string)=>!['Returned','Cancelled'].includes(borrow.status)&&borrow.dueDate<asOf;
const assignmentTransitions:Record<AssignmentStatus,AssignmentStatus[]>={'Draft':['Pending approval','Cancelled'],'Pending approval':['Approved','Cancelled'],'Approved':['Active','Cancelled'],'Active':['Return requested','Returned','Reassigned','Closed'],'Return requested':['Returned','Active'],'Returned':['Closed'],'Cancelled':[],'Expired':['Closed','Return requested'],'Reassigned':['Closed'],'Closed':[]};
export const canTransitionAssignment=(from:AssignmentStatus,to:AssignmentStatus)=>assignmentTransitions[from].includes(to);
const borrowTransitions:Record<BorrowRecord['status'],BorrowRecord['status'][]>={
  Draft:['Pending Approval','Cancelled'],'Pending Approval':['Approved','Rejected','Cancelled'],Approved:['Issued','Cancelled'],Rejected:[],Issued:['Partially Returned','Returned','Overdue'],['Partially Returned']:['Returned','Overdue'],Returned:[],Overdue:['Partially Returned','Returned'],Cancelled:[]
};
export const canTransitionBorrow=(from:BorrowRecord['status'],to:BorrowRecord['status'])=>borrowTransitions[from].includes(to);
export const validDateRange=(start:string,end:string)=>Boolean(start&&end&&end>=start);
export const daysOverdue=(dueDate:string,asOf:string)=>Math.max(0,Math.floor((Date.parse(`${asOf}T00:00:00Z`)-Date.parse(`${dueDate}T00:00:00Z`))/86400000));
export function accessoryDiscrepancies(issued:AssignmentAccessory[],returned:string[]){return issued.filter(item=>!returned.includes(item.name)).map(item=>({...item,missing:true,returned:false}))}
export function conditionAssessment(before:string,after:string){const order=['New','Excellent','Good','Fair','Poor','Defective','Beyond Repair'];const change=order.indexOf(after)-order.indexOf(before);return change<=0?'No deterioration':change===1?'Normal wear':change===2?'Minor damage':change>=4?'Major damage':'Requires inspection'}
export const assignmentEligible=(status:AssetStatus)=>status==='Available';
export const borrowEligible=(status:AssetStatus)=>status==='Available'||status==='Reserved';
const repairTransitions:Record<string,string[]>={Reported:['Diagnosing','Cancelled'],Diagnosing:['Awaiting Approval','Waiting for Parts','In Repair','External Repair','Unrepairable'],['Awaiting Approval']:['Approved','Rejected','Cancelled'],Approved:['Waiting for Parts','In Repair','External Repair','Cancelled'],Rejected:[],['Waiting for Parts']:['In Repair','External Repair','Cancelled'],['In Repair']:['Testing','Unrepairable','Cancelled'],['External Repair']:['Testing','Completed','Unrepairable'],Testing:['Completed','In Repair','Unrepairable'],Completed:['Returned to User'],Unrepairable:['Returned to User'],['Returned to User']:[],Cancelled:[]};
export const canTransitionRepair=(from:Repair['status'],to:string)=>repairTransitions[from]?.includes(to)||false;
const maintenanceTransitions:Record<string,string[]>={Draft:['Scheduled','Cancelled'],Scheduled:['Due','In Progress','Completed','Skipped','Cancelled'],Due:['In Progress','Completed','Skipped','Cancelled'],Overdue:['In Progress','Completed','Skipped','Cancelled'],['In Progress']:['Paused','Completed','Cancelled'],Paused:['In Progress','Cancelled'],Completed:[],Skipped:[],Cancelled:[]};
export const canTransitionMaintenance=(from:Maintenance['status'],to:Maintenance['status'])=>maintenanceTransitions[from]?.includes(to)||false;
export const validMaintenanceSchedule=(date:string,frequency:string,customDays=0)=>Boolean(date)&&frequency!=='Custom interval'||customDays>0;
export const maintenanceDaysOverdue=(due:string,nowDate=new Date())=>Math.max(0,Math.floor((Date.UTC(nowDate.getUTCFullYear(),nowDate.getUTCMonth(),nowDate.getUTCDate())-Date.parse(`${due}T00:00:00Z`))/86400000));
export const validMovement=(quantity:number,source:string,destination:string)=>Number.isFinite(quantity)&&quantity>0&&Boolean(source.trim())&&Boolean(destination.trim())&&source.trim()!==destination.trim();
export const correctionQuantity=(current:number,original:number,correction:number)=>current-original+correction;
const auditTransitions:Record<string,string[]>={Draft:['Scheduled','Sample Generated','Cancelled'],Scheduled:['Sample Generated','Overdue','Cancelled'],['Sample Generated']:['Prepared','Cancelled'],Prepared:['In Progress','Cancelled'],['In Progress']:['Paused','Review Required','Cancelled'],Paused:['In Progress','Cancelled'],['Review Required']:['In Progress','Corrective Actions Required','Completed'],['Corrective Actions Required']:['Review Required','Completed'],Completed:['Closed'],Closed:[],Cancelled:[],Overdue:['In Progress','Cancelled']};
export const canTransitionAudit=(from:Audit['status'],to:Audit['status'])=>auditTransitions[from]?.includes(to)||false;
export const auditConfigurationValid=(input:{start?:string;deadline:string;auditors:string[];method:string;value?:number})=>Boolean(input.auditors.length&&input.deadline&&(!input.start||input.deadline>=input.start)&&(input.method==='Full audit'||Number(input.value)>0)&&(input.method!=='Percentage'||Number(input.value)<=100));
const seeded=(seed:string)=>{let value=[...seed].reduce((acc,char)=>(acc*31+char.charCodeAt(0))>>>0,2166136261);return()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296)};
export function deterministicAuditSelection<T extends {id:string}>(population:T[],options:{seed:string;method:'Fixed count'|'Percentage'|'Full audit';value?:number;excludedIds?:string[]}){
  const eligible=population.filter(item=>!options.excludedIds?.includes(item.id));
  const requested=options.method==='Full audit'?eligible.length:options.method==='Percentage'?Math.ceil(eligible.length*Math.min(100,Math.max(1,Number(options.value)))/100):Math.floor(Number(options.value));
  if(requested<1||requested>eligible.length)throw new Error('Sample population is too small.');
  const random=seeded(options.seed),items=[...eligible];
  for(let index=items.length-1;index>0;index--){const target=Math.floor(random()*(index+1));[items[index],items[target]]=[items[target],items[index]]}
  return items.slice(0,requested);
}
export const auditProgress=(items:AuditItem[])=>({reviewed:items.filter(item=>item.result).length,verified:items.filter(item=>item.result==='Verified').length,discrepancies:items.filter(item=>item.result&&item.result!=='Verified'&&!item.deferred).length,deferred:items.filter(item=>item.deferred).length,percentage:items.length?Math.round(items.filter(item=>item.result).length/items.length*100):0,quantityVariance:items.reduce((sum,item)=>sum+(item.variance||0),0)});
export const scanAuditItem=(items:AuditItem[],code:string,scannedIds:string[])=>scannedIds.includes(code)?'duplicate':items.some(item=>item.code===code)?'match':'mismatch';
export const classifyQuantityVariance=(expected:number,counted:number)=>counted===expected?'Verified':counted<expected?'Quantity Shortage':'Quantity Surplus';
export const discrepancySeverity=(type:string,variance=0)=>/stolen|missing asset|safety/i.test(type)?'Critical':Math.abs(variance)>=10?'High':/damage|shortage/i.test(type)?'Medium':'Low';
const correctiveTransitions:Record<CorrectiveAction['status'],CorrectiveAction['status'][]> = {Draft:['Assigned','Cancelled'],Assigned:['In Progress','Cancelled'],['In Progress']:['Pending Approval','Completed','Cancelled'],['Pending Approval']:['Approved','Rejected'],Approved:['Completed'],Rejected:['In Progress'],Completed:['Verified'],Verified:['Closed'],Closed:[],Cancelled:[],Overdue:['In Progress','Cancelled']};
export const canTransitionCorrectiveAction=(from:CorrectiveAction['status'],to:CorrectiveAction['status'])=>correctiveTransitions[from].includes(to);
export const auditCompletionEligible=(audit:Audit)=>Boolean(audit.sampleItems?.length&&audit.sampleItems.every(item=>item.result&&!item.deferred)&&audit.progress===100);
export const validReportDateRange=(from:string,to:string)=>Boolean(from&&to&&from<=to);
export const validateReportDefinition=(definition:Pick<ReportDefinition,'name'|'category'|'columns'|'dateRange'>)=>Boolean(definition.name.trim()&&definition.category&&definition.columns?.length&&(!definition.dateRange||validReportDateRange(definition.dateRange.from,definition.dateRange.to)));
export const authorizedReportFields=(requested:string[],allowed:string[])=>requested.filter(field=>allowed.includes(field));
export const protectSpreadsheetCell=(value:unknown)=>{const text=String(value??'');return /^[=+\-@]/.test(text)?`'${text}`:text};
export const csvCell=(value:unknown)=>{const protectedValue=protectSpreadsheetCell(value);return /[",\r\n]/.test(protectedValue)?`"${protectedValue.replaceAll('"','""')}"`:protectedValue};
export const reportFileName=(name:string,format:string,date=todayString())=>`${name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'report'}-${date}.${format.toLowerCase()}`;
const todayString=()=>new Date().toISOString().slice(0,10);
export const nextScheduledRun=(date:string,recurrence:'Daily'|'Weekly'|'Monthly'|'Quarterly'|'Annual')=>{const value=new Date(`${date}T12:00:00Z`);if(recurrence==='Daily')value.setUTCDate(value.getUTCDate()+1);else if(recurrence==='Weekly')value.setUTCDate(value.getUTCDate()+7);else value.setUTCMonth(value.getUTCMonth()+(recurrence==='Monthly'?1:recurrence==='Quarterly'?3:12));return value.toISOString().slice(0,10)};
export const notificationKey=(sourceEventId:string,recipient:string,type:string,relatedId='')=>[sourceEventId,recipient,type,relatedId].join('|');
export const rate=(part:number,total:number)=>total>0?Math.round(part/total*1000)/10:0;
export const riskSeverity=(score:number)=>score>=80?'Critical':score>=60?'High':score>=40?'Medium':score>=20?'Low':'Informational';
export const dataQualityIndicators=(assets:Asset[])=>({missingSerial:assets.filter(asset=>!asset.serialNumber).length,missingQr:assets.filter(asset=>!asset.qr).length,missingResponsible:assets.filter(asset=>!asset.responsibleEmployee&&!asset.assignedTo).length,missingLocation:assets.filter(asset=>!asset.location).length,missingDepartment:assets.filter(asset=>!asset.department).length,missingWarranty:assets.filter(asset=>!asset.warrantyExpiry).length});
export function nextMaintenanceDate(date:string,frequency:string){const value=new Date(`${date}T12:00:00Z`);const months=frequency==='Weekly'?0:frequency==='Monthly'?1:frequency==='Quarterly'?3:frequency==='Every six months'?6:12;if(frequency==='Weekly')value.setUTCDate(value.getUTCDate()+7);else value.setUTCMonth(value.getUTCMonth()+months);return value.toISOString().slice(0,10)}
export function deterministicAuditSample<T extends{id:string}>(records:T[],count:number,recentIds:string[]=[]){return records.filter(record=>!recentIds.includes(record.id)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,Math.max(0,count))}
const disposalTransitions:Record<DisposalStatus,DisposalStatus[]>={Requested:['Inspected','Rejected'],Inspected:['Approved','Rejected'],Approved:['Method Selected'],Rejected:[],['Method Selected']:['Completed'],Completed:['Permanently Archived'],['Permanently Archived']:[]};
export const canTransitionDisposal=(from:DisposalStatus,to:DisposalStatus)=>disposalTransitions[from].includes(to);
export const validThemes:ThemeId[]=['aimsAzureGlass','aimsMidnight','aimsEmeraldGloss','aimsLight'];
export const normalizeTheme=(value:string|null):ThemeId=>{
 if(value==='kcs-azure-intelligence'||value==='kcsAzureGlass')return'aimsAzureGlass';
 if(value==='aims-midnight'||value==='midnight-blue')return'aimsMidnight';
 if(value==='kcs-forest-gold'||value==='aimsEmeraldGlass')return'aimsEmeraldGloss';
 if(value==='emerald-gloss')return'aimsEmeraldGloss';
 if(value==='aims-light'||value==='aimsLight')return'aimsAzureGlass';
 return validThemes.includes(value as ThemeId)?value as ThemeId:'aimsAzureGlass';
};
