import {ArrowDownToLine,ArrowUpFromLine,Edit3,PackagePlus,Plus,RotateCcw,ShieldAlert,Shuffle} from 'lucide-react';
import {useMemo,useState,type FormEvent} from 'react';
import {Badge,Button,Field,TextAreaField} from '../components/ui';
import {DataTable,type DataColumn} from '../components/DataTable';
import {ConfirmDialog,Dialog,MutationFeedback,OfflineGate,PageHeader} from '../components/WorkflowUi';
import {useApp} from '../context/AppContext';
import type {InventoryItem,WorkflowAction} from '../data/contracts';
import {useMockSnapshot,useRepository} from '../data/mockRepository';

type Operation='create'|'edit'|'receive'|'issue'|'transfer'|'reserve'|'return'|'correct';
const operations:Record<Operation,{action:WorkflowAction;icon:typeof Plus;highRisk?:boolean}>={
  create:{action:'inventory.create',icon:PackagePlus},edit:{action:'inventory.edit',icon:Edit3},
  receive:{action:'stock.receive',icon:ArrowDownToLine},issue:{action:'stock.issue',icon:ArrowUpFromLine,highRisk:true},
  transfer:{action:'stock.transfer',icon:Shuffle},reserve:{action:'stock.reserve',icon:ShieldAlert},
  return:{action:'stock.return',icon:RotateCcw},correct:{action:'stock.correct',icon:Edit3,highRisk:true}
};

export default function InventoryPage(){
  const {language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),repository=useRepository();
  const [selected,setSelected]=useState<InventoryItem|null>(null),[operation,setOperation]=useState<Operation|null>(null),[lowOnly,setLowOnly]=useState(false),[confirm,setConfirm]=useState(false);
  const [feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  const rows=useMemo(()=>snapshot.inventory.filter(item=>!lowOnly||item.onHand-item.reserved<item.minimum),[lowOnly,snapshot.inventory]);
  const columns:DataColumn<InventoryItem>[]=[
    {id:'code',label:nl?'Artikelcode':'Item code',render:item=><strong>{item.code}</strong>,text:item=>item.code,sortable:true},
    {id:'name',label:nl?'Artikel':'Item',render:item=>item.name,text:item=>item.name,sortable:true},
    {id:'onHand',label:nl?'Op voorraad':'On hand',render:item=>item.onHand,text:item=>item.onHand,sortable:true},
    {id:'reserved',label:nl?'Gereserveerd':'Reserved',render:item=>item.reserved,text:item=>item.reserved,sortable:true},
    {id:'available',label:nl?'Beschikbaar':'Available',render:item=>item.onHand-item.reserved,text:item=>item.onHand-item.reserved,sortable:true},
    {id:'minimum',label:nl?'Minimum':'Minimum',render:item=>item.minimum,text:item=>item.minimum},
    {id:'location',label:nl?'Locatie':'Location',render:item=>item.location,text:item=>item.location,sortable:true},
    {id:'status',label:'Status',render:item=><Badge tone={item.archived?'neutral':item.onHand-item.reserved<item.minimum?'danger':'success'}>{item.archived?(nl?'Gearchiveerd':'Archived'):item.onHand-item.reserved<item.minimum?(nl?'Lage voorraad':'Low stock'):(nl?'Gezond':'Healthy')}</Badge>,text:item=>item.archived?'Archived':'Active'}
  ];
  function open(item:InventoryItem,action:Operation){setSelected(item);setOperation(action);setFeedback({status:'idle',message:''})}
  async function execute(values:Record<string,unknown>){
    if(!operation)return;
    setFeedback({status:'loading',message:nl?'Mockactie uitvoeren…':'Running mock operation…'});
    const result=await repository.execute({action:operations[operation].action,entityId:selected?.id,values});
    setFeedback({status:result.ok?'success':'error',message:result.message});
    if(result.ok&&operation==='create')setTimeout(()=>{setOperation(null);setSelected(null)},350);
    else if(result.ok&&operation!=='edit')setOperation('edit');
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget);const values:Record<string,unknown>=Object.fromEntries(data.entries());
    if(operation==='correct')values.delta=Number(values.delta);else if(values.quantity)values.quantity=Number(values.quantity);
    if(operations[operation!].highRisk){setConfirm(true);(event.currentTarget as HTMLFormElement).dataset.values=JSON.stringify(values)}else void execute(values);
  }
  return <OfflineGate><div className="page">
    <PageHeader title={nl?'Magazijnvoorraad':'Warehouse inventory'} description={nl?'Beheer hoeveelheden, reserveringen, overdrachten en minimumvoorraad.':'Manage quantities, reservations, transfers and minimum stock.'} actions={<Button onClick={()=>{setSelected(null);setOperation('create')}}><Plus/>{nl?'Artikel toevoegen':'Add item'}</Button>}/>
    <div className="status-summary"><section className="card"><b>{snapshot.inventory.length}</b><small>{nl?'Artikelen':'Items'}</small></section><section className="card"><b>{snapshot.inventory.reduce((sum,item)=>sum+item.onHand,0)}</b><small>{nl?'Totaal op voorraad':'Total on hand'}</small></section><section className="card"><b>{snapshot.inventory.reduce((sum,item)=>sum+item.reserved,0)}</b><small>{nl?'Gereserveerd':'Reserved'}</small></section><section className="card"><b>{snapshot.inventory.filter(item=>item.onHand-item.reserved<item.minimum).length}</b><small>{nl?'Lage voorraad':'Low stock'}</small></section></div>
    <section className="card data-card"><DataTable id="inventory" rows={rows} columns={columns} rowKey={item=>item.id} searchPlaceholder={nl?'Zoek voorraad…':'Search inventory…'} emptyTitle={nl?'Geen voorraadartikelen':'No inventory items'} emptyDescription={nl?'Pas filters aan of voeg een artikel toe.':'Adjust filters or add an item.'} onRowClick={item=>open(item,'edit')} filters={<label className="switch-row compact"><input type="checkbox" checked={lowOnly} onChange={event=>setLowOnly(event.target.checked)}/><span>{nl?'Alleen lage voorraad':'Low stock only'}</span></label>} onBulkAction={async(ids,action)=>{for(const entityId of ids)await repository.execute({action:action==='archive'?'inventory.archive':'inventory.restore',entityId})}}/></section>
    <Dialog open={!!operation} title={operation==='create'?(nl?'Voorraadartikel toevoegen':'Add inventory item'):operation==='edit'?(nl?'Voorraadartikel bewerken':'Edit inventory item'):`${nl?'Voorraadactie':'Stock operation'}: ${operation}`} description={selected?.name} onClose={()=>{setOperation(null);setSelected(null)}}>
      {operation==='edit'&&selected&&<div className="subnav">{(['receive','issue','transfer','reserve','return','correct'] as Operation[]).map(action=>{const Icon=operations[action].icon;return <button key={action} onClick={()=>setOperation(action)}><Icon/>{action}</button>})}</div>}
      <form className="workflow-form" onSubmit={submit}>
        {(operation==='create'||operation==='edit')&&<><Field name="code" label={nl?'Artikelcode':'Item code'} defaultValue={selected?.code} required/><Field name="name" label={nl?'Naam':'Name'} defaultValue={selected?.name} required/><Field name="category" label={nl?'Categorie':'Category'} defaultValue={selected?.category}/><Field name="location" label={nl?'Locatie':'Location'} defaultValue={selected?.location} required/><Field name="minimum" type="number" min="0" label={nl?'Minimumvoorraad':'Minimum stock'} defaultValue={selected?.minimum}/><Field name="onHand" type="number" min="0" label={nl?'Beginvoorraad':'Opening stock'} defaultValue={selected?.onHand}/></>}
        {operation&&['receive','issue','reserve','return'].includes(operation)&&<Field name="quantity" type="number" min="1" label={nl?'Aantal':'Quantity'} required/>}
        {operation==='transfer'&&<><Field name="quantity" type="number" min="1" label={nl?'Aantal':'Quantity'} required/><Field name="destination" label={nl?'Bestemming':'Destination'} required/></>}
        {operation==='correct'&&<><Field name="delta" type="number" label={nl?'Correctie (+/-)':'Correction (+/-)'} required/><TextAreaField name="reason" className="wide" label={nl?'Verplichte reden':'Required reason'} required/></>}
        {operation&&<div className="wide"><MutationFeedback {...feedback}/><Button type="submit">{nl?'Uitvoeren':'Execute'}</Button></div>}
      </form>
    </Dialog>
    <ConfirmDialog open={confirm} title={nl?'Voorraadactie bevestigen':'Confirm stock action'} description={nl?'Deze actie wijzigt de voorraad en maakt een mutatierecord.':'This action changes stock and creates a movement record.'} confirmLabel={nl?'Bevestigen':'Confirm'} danger onClose={()=>setConfirm(false)} onConfirm={async()=>{const form=document.querySelector<HTMLFormElement>('.dialog .workflow-form');const values=form?.dataset.values?JSON.parse(form.dataset.values):{};await execute(values)}}/>
  </div></OfflineGate>;
}
