import {useMemo} from 'react';
import {can,type Permission} from '../auth/permissions';
import {useApp} from '../context/AppContext';
import {useMockSnapshot} from '../data/mockRepository';
import type {MockSnapshot} from '../data/contracts';
import type {Role} from '../domain/types';
import type {GlobalSearchResult,GlobalSearchResultType} from '../types/search';
export const normalizeSearchValue=(value:string)=>value.toLocaleLowerCase('nl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');
const text=(...values:unknown[])=>normalizeSearchValue(values.flat().filter(value=>value!==undefined&&value!==null).join(' '));
const permission:Record<GlobalSearchResultType,Permission>={asset:'assets.view',user:'users.manage',location:'locations.manage',department:'departments.manage',assignment:'assignments.manage',maintenance:'maintenance.manage',repair:'repairs.manage',category:'categories.manage'};
export function buildGlobalSearchIndex(snapshot:MockSnapshot,role:Role){
 const results:GlobalSearchResult[]=[];const add=(result:GlobalSearchResult)=>{if(can(role,permission[result.type]))results.push({...result,searchableText:normalizeSearchValue(result.searchableText)})};
 snapshot.assets.forEach(x=>add({id:x.id,type:'asset',title:x.name,subtitle:[x.category,x.department,x.location,x.status].filter(Boolean).join(' · '),code:x.code,route:`/assets/${x.id}`,searchableText:text(x.code,x.previousCodes,x.name,x.category,x.subcategory,x.type,x.brand,x.model,x.serialNumber,x.barcode,x.assignedTo,x.responsibleEmployee,x.department,x.location,x.status)}));
 snapshot.inventory.forEach(x=>add({id:x.id,type:'asset',title:x.name,subtitle:[x.category,x.department,x.location,x.workflowStatus].filter(Boolean).join(' · '),code:x.code,route:`/inventory/${x.id}`,searchableText:text(x.code,x.barcode,x.name,x.description,x.category,x.subcategory,x.brand,x.model,x.manufacturer,x.supplier,x.location,x.department,x.workflowStatus)}));
 snapshot.users.forEach(x=>add({id:x.id,type:'user',title:x.name,subtitle:[x.email,x.department,x.role].join(' · '),route:`/users?user=${encodeURIComponent(x.id)}`,searchableText:text(x.name,x.email,x.department,x.role,x.status)}));
 snapshot.references.forEach(x=>add({id:x.id,type:x.kind,title:x.name,subtitle:[x.type,x.parent,x.status].filter(Boolean).join(' · '),route:`/${x.kind==='category'?'categories':x.kind==='location'?'locations':'departments'}?${x.kind}=${encodeURIComponent(x.id)}`,searchableText:text(x.name,x.type,x.parent,x.status,Object.values(x.details))}));
 snapshot.assignments.forEach(x=>add({id:x.id,type:'assignment',title:x.assignee,subtitle:[x.assetName,x.department,x.location,x.status].join(' · '),code:x.assetCode||x.reference,route:`/assignments/${x.id}`,searchableText:text(x.reference,x.assetCode,x.assetName,x.category,x.assignee,x.department,x.location,x.status)}));
 snapshot.maintenance.forEach(x=>add({id:x.id,type:'maintenance',title:x.asset,subtitle:[x.type,x.assignee,x.status].join(' · '),code:x.reference||x.assetCode,route:`/maintenance?record=${encodeURIComponent(x.id)}`,searchableText:text(x.reference,x.assetCode,x.asset,x.category,x.location,x.department,x.type,x.assignee,x.status,x.notes,x.issuesFound)}));
 snapshot.repairs.forEach(x=>add({id:x.id,type:'repair',title:x.asset,subtitle:[x.issue,x.technician,x.status].join(' · '),code:x.reference||x.assetCode,route:`/repairs/${x.id}`,searchableText:text(x.reference,x.assetCode,x.asset,x.assetName,x.serialNumber,x.category,x.issue,x.problemTitle,x.technician,x.status,x.diagnosis,x.rootCause)}));return results;
}
export function filterGlobalSearchResults(index:GlobalSearchResult[],query:string){const words=normalizeSearchValue(query).split(' ').filter(Boolean);if(words.join('').length<2)return[];const counts=new Map<GlobalSearchResultType,number>();return index.filter(result=>{if(!words.every(word=>result.searchableText.includes(word)))return false;const count=counts.get(result.type)||0;if(count>=5)return false;counts.set(result.type,count+1);return true}).slice(0,20)}
export function useGlobalSearch(query:string){const snapshot=useMockSnapshot(),{user}=useApp();const index=useMemo(()=>user?buildGlobalSearchIndex(snapshot,user.role):[],[snapshot,user]);const results=useMemo(()=>filterGlobalSearchResults(index,query),[index,query]);return{results,isLoading:false,error:null as Error|null}}
