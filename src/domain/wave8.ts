import type {Permission} from '../auth/permissions';
import type {MockSnapshot} from '../data/contracts';

export type AiIntent='low-stock'|'available-assets'|'overdue-borrows'|'repairs'|'maintenance'|'audit'|'access-denial'|'unsupported'|'mutation';
export interface AiAssistantRequest{query:string;language:'en'|'nl';permissions:readonly Permission[];snapshot:MockSnapshot}
export interface AiAssistantCitation{type:string;id:string;reference:string}
export interface AiAssistantResponse{intent:AiIntent;answer:string;citations:AiAssistantCitation[];workflow?:string;mock:boolean;readOnly:true;blocked:boolean;limitations:string[]}
export interface AiAssistantProvider{query(request:AiAssistantRequest):Promise<AiAssistantResponse>}
export type AiAssistantCategoryKey='low-stock'|'available-assets'|'overdue-borrows'|'repairs'|'maintenance';
export interface AiAssistantCategory{key:AiAssistantCategoryKey;permission:Permission;workflow:string;count:number;items:AiAssistantCitation[]}
export const aiAssistantCategoryKeys:readonly AiAssistantCategoryKey[]=['low-stock','available-assets','overdue-borrows','repairs','maintenance'];

const mutationWords=/\b(add|create|delete|remove|assign|approve|reject|dispose|change|update|edit|issue|return|correct|grant|revoke|suspend|reactivate)\b/i;
const has=(permissions:readonly Permission[],permission:Permission)=>permissions.includes(permission);
export const classifyAiIntent=(query:string):AiIntent=>{
  if(mutationWords.test(query))return'mutation';
  const text=query.toLowerCase();
  if(text.includes('low stock')||text.includes('lage voorraad'))return'low-stock';
  if(text.includes('available')||text.includes('beschikbaar'))return'available-assets';
  if(text.includes('overdue')&&(text.includes('borrow')||text.includes('leen')))return'overdue-borrows';
  if(text.includes('repair')||text.includes('repar'))return'repairs';
  if(text.includes('maintenance')||text.includes('onderhoud'))return'maintenance';
  if(text.includes('audit'))return'audit';
  if(text.includes('access')||text.includes('toegang'))return'access-denial';
  return'unsupported';
};

export const buildAiAssistantCategories=({permissions,snapshot}:Pick<AiAssistantRequest,'permissions'|'snapshot'>):AiAssistantCategory[]=>{
  const categories:AiAssistantCategory[]=[];
  if(has(permissions,'inventory.view')){
    const rows=snapshot.inventory.filter(item=>item.onHand-item.reserved<item.minimum);
    categories.push({key:'low-stock',permission:'inventory.view',workflow:'/inventory/low-stock',count:rows.length,items:rows.slice(0,8).map(x=>({type:'inventory',id:x.id,reference:x.code}))});
  }
  if(has(permissions,'assets.view')){
    const rows=snapshot.assets.filter(asset=>asset.status==='Available');
    categories.push({key:'available-assets',permission:'assets.view',workflow:'/assets',count:rows.length,items:rows.slice(0,8).map(x=>({type:'asset',id:x.id,reference:x.code}))});
  }
  if(has(permissions,'borrows.view')){
    const rows=snapshot.borrows.filter(record=>record.status==='Overdue');
    categories.push({key:'overdue-borrows',permission:'borrows.view',workflow:'/borrows/overdue',count:rows.length,items:rows.slice(0,8).map(x=>({type:'borrow',id:x.id,reference:x.reference||x.id}))});
  }
  if(has(permissions,'repairs.view')){
    categories.push({key:'repairs',permission:'repairs.view',workflow:'/repairs',count:snapshot.repairs.length,items:snapshot.repairs.slice(0,8).map(x=>({type:'repair',id:x.id,reference:x.reference}))});
  }
  if(has(permissions,'maintenance.view')){
    categories.push({key:'maintenance',permission:'maintenance.view',workflow:'/maintenance',count:snapshot.maintenance.length,items:snapshot.maintenance.slice(0,8).map(x=>({type:'maintenance',id:x.id,reference:x.reference||x.id}))});
  }
  return categories;
};

export class DeterministicMockAiProvider implements AiAssistantProvider{
  async query({query,language,permissions,snapshot}:AiAssistantRequest):Promise<AiAssistantResponse>{
    const nl=language==='nl',intent=classifyAiIntent(query);
    const base={intent,citations:[] as AiAssistantCitation[],mock:true as const,readOnly:true as const,blocked:false,limitations:[nl?'Gesimuleerde momentopname; verifieer live gegevens.':'Simulated snapshot; verify live data.']};
    if(intent==='mutation')return{...base,blocked:true,workflow:'/dashboard',answer:nl?'Ik ben alleen adviserend en kan deze wijziging niet uitvoeren. Open de normale workflow en laat een bevoegde medewerker de actie beoordelen.':'I am advisory and cannot execute this change. Open the normal workflow and have an authorized person review the action.'};
    if(intent==='low-stock'&&has(permissions,'inventory.view')){
      const rows=snapshot.inventory.filter(item=>item.onHand-item.reserved<item.minimum);
      return{...base,answer:nl?`${rows.length} artikelen liggen onder het minimum.`:`${rows.length} items are below minimum stock.`,workflow:'/inventory/low-stock',citations:rows.slice(0,5).map(x=>({type:'inventory',id:x.id,reference:x.code}))};
    }
    if(intent==='available-assets'&&has(permissions,'assets.view')){
      const rows=snapshot.assets.filter(asset=>asset.status==='Available');
      return{...base,answer:nl?`${rows.length} middelen zijn beschikbaar.`:`${rows.length} assets are available.`,workflow:'/assets',citations:rows.slice(0,5).map(x=>({type:'asset',id:x.id,reference:x.code}))};
    }
    if(intent==='overdue-borrows'&&has(permissions,'borrows.view')){
      const rows=snapshot.borrows.filter(record=>record.status==='Overdue');
      return{...base,answer:nl?`${rows.length} leenrecords zijn te laat.`:`${rows.length} borrow records are overdue.`,workflow:'/borrows/overdue',citations:rows.slice(0,5).map(x=>({type:'borrow',id:x.id,reference:x.reference||x.id}))};
    }
    if(intent==='repairs'&&has(permissions,'repairs.view')){
      return{...base,answer:nl?`${snapshot.repairs.length} reparatierecords zijn zichtbaar binnen uw scope.`:`${snapshot.repairs.length} repair records are visible in your scope.`,workflow:'/repairs',citations:snapshot.repairs.slice(0,5).map(x=>({type:'repair',id:x.id,reference:x.reference}))};
    }
    if(intent==='maintenance'&&has(permissions,'maintenance.view')){
      return{...base,answer:nl?`${snapshot.maintenance.length} onderhoudsrecords zijn zichtbaar binnen uw scope.`:`${snapshot.maintenance.length} maintenance records are visible in your scope.`,workflow:'/maintenance',citations:snapshot.maintenance.slice(0,5).map(x=>({type:'maintenance',id:x.id,reference:x.reference||x.id}))};
    }
    if(intent==='access-denial')return{...base,answer:nl?'Toegang wordt bepaald door uw effectieve rol, directe weigeringen en afdeling- of locatiescope. Vraag een beheerder om een toegangsreview.':'Access is determined by your effective role, direct denials, and department or location scope. Ask an administrator for an access review.',workflow:'/403'};
    return{...base,blocked:true,answer:nl?'Deze vraag wordt niet ondersteund of de benodigde gegevens vallen buiten uw bevoegdheden.':'This question is unsupported or the required data is outside your authorized scope.'};
  }
}

export const effectivePermissions=(role:readonly Permission[],grants:readonly Permission[]=[],denials:readonly Permission[]=[])=>
  [...new Set([...role,...grants])].filter(permission=>!denials.includes(permission));

export const canChangeAdministrator=(users:{role:string;status:string}[],target:{role:string;status:string})=>
  !(target.role==='Administrator'&&target.status==='Active'&&users.filter(user=>user.role==='Administrator'&&user.status==='Active').length<=1);
