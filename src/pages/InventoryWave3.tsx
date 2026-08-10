import {ArrowLeftRight,Download,PackagePlus,RotateCcw,ShieldCheck,TriangleAlert} from 'lucide-react';
import {useMemo,useState,type FormEvent} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {Badge,Button,Field,SelectField,TextAreaField} from '../components/ui';
import {DataTable,type DataColumn} from '../components/DataTable';
import {ConfirmDialog,MutationFeedback,OfflineGate,PageHeader} from '../components/WorkflowUi';
import {useApp} from '../context/AppContext';
import {availableStock,reorderRecommendation,stockStatus} from '../domain/rules';
import type {InventoryItem,StockReservation,WorkflowAction} from '../data/contracts';
import {useMockSnapshot,useRepository} from '../data/mockRepository';

const operationMeta={
  receive:{action:'stock.receive',title:['Receive stock','Voorraad ontvangen'],icon:PackagePlus},
  issue:{action:'stock.issue',title:['Issue stock','Voorraad uitgeven'],icon:Download,risk:true},
  transfer:{action:'stock.transfer',title:['Transfer stock','Voorraad overboeken'],icon:ArrowLeftRight},
  return:{action:'stock.return',title:['Return stock','Voorraad retourneren'],icon:RotateCcw},
  correct:{action:'stock.correct',title:['Correct stock','Voorraad corrigeren'],icon:TriangleAlert,risk:true},
} satisfies Record<string,{action:WorkflowAction;title:[string,string];icon:typeof PackagePlus;risk?:boolean}>;

const itemColumns=(nl:boolean):DataColumn<InventoryItem>[]=>[
  {id:'code',label:nl?'Artikelcode':'Item code',render:x=><Link to={`/inventory/${x.id}`}><strong>{x.code}</strong></Link>,text:x=>x.code,sortable:true},
  {id:'name',label:nl?'Artikelnaam':'Item name',render:x=>x.name,text:x=>x.name,sortable:true},
  {id:'category',label:nl?'Categorie':'Category',render:x=>x.category,text:x=>x.category},
  {id:'brand',label:nl?'Merk/model':'Brand / model',render:x=>[x.brand,x.model].filter(Boolean).join(' '),text:x=>`${x.brand} ${x.model}`},
  {id:'onHand',label:nl?'Op voorraad':'On hand',render:x=>x.onHand,text:x=>x.onHand,sortable:true},
  {id:'reserved',label:nl?'Gereserveerd':'Reserved',render:x=>x.reserved,text:x=>x.reserved},
  {id:'available',label:nl?'Beschikbaar':'Available',render:x=>availableStock(x),text:x=>availableStock(x),sortable:true},
  {id:'minimum',label:'Minimum',render:x=>x.minimum,text:x=>x.minimum},
  {id:'status',label:'Status',render:x=><Badge tone={stockStatus(x)==='Low stock'||stockStatus(x)==='Out of stock'?'danger':'success'}>{stockStatus(x)}</Badge>,text:x=>stockStatus(x)},
  {id:'location',label:nl?'Opslagpositie':'Storage position',render:x=><span className="wrap-path">{x.warehouse} / {x.location}</span>,text:x=>x.location},
  {id:'supplier',label:nl?'Leverancier':'Supplier',render:x=>x.supplier||'—',text:x=>x.supplier||''},
  {id:'updated',label:nl?'Bijgewerkt':'Updated',render:x=>x.lastUpdated.slice(0,10),text:x=>x.lastUpdated},
];

export function InventoryList(){
  const {language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot();
  const [low,setLow]=useState(false);
  const rows=useMemo(()=>snapshot.inventory.filter(x=>!low||availableStock(x)<=x.minimum),[snapshot.inventory,low]);
  return <OfflineGate><div className="page"><PageHeader title={nl?'Magazijnvoorraad':'Warehouse inventory'} description={nl?'Hoeveelheidsvoorraad, opslag en herbevoorrading.':'Quantity stock, storage and replenishment.'} actions={<div className="actions"><Link className="btn btn-secondary" to="/inventory/import">{nl?'Importeren':'Import'}</Link><Link className="btn btn-primary" to="/inventory/new"><PackagePlus/>{nl?'Artikel toevoegen':'Add item'}</Link></div>}/>
    <div className="status-summary"><section className="card"><b>{snapshot.inventory.length}</b><small>{nl?'Artikelen':'Items'}</small></section><section className="card"><b>{snapshot.inventory.reduce((n,x)=>n+x.onHand,0)}</b><small>{nl?'Op voorraad':'On hand'}</small></section><section className="card"><b>{snapshot.inventory.reduce((n,x)=>n+x.reserved,0)}</b><small>{nl?'Gereserveerd':'Reserved'}</small></section><section className="card"><b>{snapshot.inventory.filter(x=>availableStock(x)<=x.minimum).length}</b><small>{nl?'Actie vereist':'Need attention'}</small></section></div>
    <nav className="subnav" aria-label={nl?'Voorraadacties':'Inventory actions'}>{Object.keys(operationMeta).map(key=><Link key={key} to={`/inventory/${key}`}>{operationMeta[key as keyof typeof operationMeta].title[nl?1:0]}</Link>)}<Link to="/inventory/reservations">{nl?'Reserveringen':'Reservations'}</Link><Link to="/inventory/low-stock">{nl?'Lage voorraad':'Low stock'}</Link></nav>
    <section className="card data-card"><DataTable id="wave3-inventory" rows={rows} columns={itemColumns(nl)} rowKey={x=>x.id} searchPlaceholder={nl?'Zoek code, naam, merk, model of leverancier…':'Search code, name, brand, model or supplier…'} emptyTitle={nl?'Geen voorraadartikelen':'No inventory items'} emptyDescription={nl?'Pas filters aan of voeg een artikel toe.':'Adjust filters or add an item.'} filters={<label className="switch-row compact"><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/><span>{nl?'Lage voorraad en uitverkocht':'Low and out of stock'}</span></label>}/></section>
  </div></OfflineGate>
}

export function InventoryForm(){
  const {itemId}=useParams(),navigate=useNavigate(),{language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),repository=useRepository(),item=snapshot.inventory.find(x=>x.id===itemId);
  const [feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));['openingQuantity','minimum','reorderLevel','reorderQuantity','maximum','unitCost'].forEach(k=>values[k]=Number(values[k]||0) as never);setFeedback({status:'loading',message:nl?'Opslaan…':'Saving…'});const result=await repository.execute({action:item?'inventory.edit':'inventory.create',entityId:item?.id,values});setFeedback({status:result.ok?'success':'error',message:result.message});if(result.ok)navigate(`/inventory/${result.entityId}`)}
  return <OfflineGate><div className="page"><PageHeader title={item?(nl?'Voorraadartikel bewerken':'Edit inventory item'):(nl?'Voorraadartikel toevoegen':'Add inventory item')} description={nl?'Voorraadhoeveelheden worden alleen via magazijnmutaties gewijzigd.':'Stock quantities change only through warehouse movements.'}/><form className="card workflow-form inventory-form" onSubmit={submit}>
    <h2 className="wide">{nl?'Identiteit':'Identity'}</h2><Field name="name" label={nl?'Artikelnaam':'Item name'} defaultValue={item?.name} required/><Field name="code" label={nl?'Artikelcode':'Item code'} defaultValue={item?.code} required disabled={!!item}/><TextAreaField className="wide" name="description" label={nl?'Beschrijving':'Description'} defaultValue={item?.description}/><Field name="category" label={nl?'Categorie':'Category'} defaultValue={item?.category} required/><Field name="subcategory" label={nl?'Subcategorie':'Subcategory'} defaultValue={item?.subcategory}/><Field name="itemType" label={nl?'Artikeltype':'Item type'} defaultValue={item?.itemType} required/>
    <h2 className="wide">{nl?'Productinformatie':'Product information'}</h2>{['brand','model','manufacturer','supplier','supplierItemCode'].map(k=><Field key={k} name={k} label={k.replace(/[A-Z]/g,m=>` ${m}`).replace(/^./,m=>m.toUpperCase())} defaultValue={String(item?.[k as keyof InventoryItem]??'')}/>)}<Field name="unit" label={nl?'Maateenheid':'Unit of measure'} defaultValue={item?.unit} required/>
    <h2 className="wide">{nl?'Voorraadinstellingen':'Stock settings'}</h2>{!item&&<Field name="openingQuantity" type="number" min="0" label={nl?'Beginvoorraad':'Opening quantity'} defaultValue={0}/>}<Field name="minimum" type="number" min="0" label="Minimum" defaultValue={item?.minimum}/><Field name="reorderLevel" type="number" min="0" label={nl?'Bestelniveau':'Reorder level'} defaultValue={item?.reorderLevel}/><Field name="reorderQuantity" type="number" min="0" label={nl?'Bestelhoeveelheid':'Reorder quantity'} defaultValue={item?.reorderQuantity}/><Field name="maximum" type="number" min="0" label="Maximum" defaultValue={item?.maximum}/>
    <h2 className="wide">{nl?'Opslag':'Storage'}</h2>{['warehouse','storageRoom','shelf','rack','location','department'].map(k=><Field key={k} name={k} label={k.replace(/[A-Z]/g,m=>` ${m}`).replace(/^./,m=>m.toUpperCase())} defaultValue={String(item?.[k as keyof InventoryItem]??'')} required={k==='warehouse'||k==='location'}/>)}
    <h2 className="wide">{nl?'Inkoop en notities':'Procurement and notes'}</h2><Field name="unitCost" type="number" min="0" step="0.01" label={nl?'Eenheidsprijs':'Unit cost'} defaultValue={item?.unitCost}/><Field name="currency" label={nl?'Valuta':'Currency'} defaultValue={item?.currency||'SRD'}/><Field name="batchNumber" label={nl?'Batch/lot':'Batch / lot'} defaultValue={item?.batchNumber}/><Field name="expirationDate" type="date" label={nl?'Vervaldatum':'Expiration date'} defaultValue={item?.expirationDate}/><TextAreaField className="wide" name="notes" label={nl?'Notities':'Notes'} defaultValue={item?.notes}/><div className="wide"><MutationFeedback {...feedback}/><Button type="submit">{nl?'Opslaan':'Save'}</Button></div>
  </form></div></OfflineGate>
}

export function InventoryDetail(){
  const {itemId}=useParams(),{language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),item=snapshot.inventory.find(x=>x.id===itemId);
  if(!item)return <div className="page"><PageHeader title={nl?'Artikel niet gevonden':'Item not found'} description={nl?'Dit voorraadartikel bestaat niet.':'This inventory item does not exist.'}/></div>;
  const movements=snapshot.inventoryMovements.filter(x=>x.itemId===item.id);
  return <OfflineGate><div className="page"><PageHeader title={item.name} description={`${item.code} · ${item.category} / ${item.subcategory||'—'}`} actions={<div className="actions"><Link className="btn btn-secondary" to={`/inventory/${item.id}/edit`}>{nl?'Bewerken':'Edit'}</Link><Link className="btn btn-primary" to={`/inventory/receive?item=${item.id}`}>{nl?'Ontvangen':'Receive'}</Link></div>}/>
    <div className="status-summary"><section className="card"><b>{item.onHand}</b><small>{nl?'Op voorraad':'On hand'}</small></section><section className="card"><b>{item.reserved}</b><small>{nl?'Gereserveerd':'Reserved'}</small></section><section className="card"><b>{availableStock(item)}</b><small>{nl?'Beschikbaar':'Available'}</small></section><section className="card"><Badge tone={stockStatus(item)==='Low stock'?'danger':'success'}>{stockStatus(item)}</Badge><small>Status</small></section></div>
    <section className="card"><h2>{nl?'Overzicht':'Overview'}</h2><dl className="detail-grid">{Object.entries({Barcode:item.barcode,Brand:item.brand,Model:item.model,Supplier:item.supplier,Unit:item.unit,Warehouse:item.warehouse,[nl?'Opslagpad':'Storage path']:item.location,[nl?'Laatst bijgewerkt':'Last updated']:item.lastUpdated}).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'—'}</dd></div>)}</dl></section>
    <section className="card"><h2>{nl?'Mutatiegeschiedenis':'Movement history'}</h2>{movements.length?<DataTable id="item-movements" rows={movements} rowKey={x=>x.id} searchPlaceholder={nl?'Zoek mutaties…':'Search movements…'} emptyTitle="" emptyDescription="" columns={[{id:'reference',label:nl?'Referentie':'Reference',render:x=>x.reference,text:x=>x.reference},{id:'type',label:'Type',render:x=>x.type,text:x=>x.type},{id:'quantity',label:nl?'Aantal':'Quantity',render:x=>x.quantity,text:x=>x.quantity},{id:'before',label:nl?'Voor → na':'Before → after',render:x=>`${x.previousQuantity} → ${x.newQuantity}`,text:x=>x.newQuantity},{id:'date',label:nl?'Datum':'Date',render:x=>x.date,text:x=>x.date}]}/>:<p className="muted">{nl?'Nog geen mutaties.':'No movements yet.'}</p>}</section>
  </div></OfflineGate>
}

export function StockOperation({kind}:{kind:keyof typeof operationMeta}){
  const {language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),repository=useRepository(),meta=operationMeta[kind],params=new URLSearchParams(location.search);
  const [confirm,setConfirm]=useState(false),[pending,setPending]=useState<Record<string,unknown>>({}),[feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  async function execute(values:Record<string,unknown>){setFeedback({status:'loading',message:nl?'Mutatie verwerken…':'Processing movement…'});const result=await repository.execute({action:meta.action,entityId:String(values.itemId),values});setFeedback({status:result.ok?'success':'error',message:result.message})}
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const values:Record<string,unknown>=Object.fromEntries(new FormData(e.currentTarget));values.quantity=Number(values.quantity);if(kind==='correct')values.delta=Number(values.delta);setPending(values);if('risk' in meta&&meta.risk)setConfirm(true);else void execute(values)}
  const Icon=meta.icon;
  return <OfflineGate><div className="page"><PageHeader title={meta.title[nl?1:0]} description={nl?'Elke actie maakt een onveranderlijk mutatierecord.':'Every action creates an immutable movement record.'}/><form className="card workflow-form" onSubmit={submit}><SelectField name="itemId" label={nl?'Artikel':'Item'} defaultValue={params.get('item')||''} required><option value="">{nl?'Selecteer artikel':'Select item'}</option>{snapshot.inventory.filter(x=>!x.archived).map(x=><option value={x.id} key={x.id}>{x.code} — {x.name} ({availableStock(x)} {nl?'beschikbaar':'available'})</option>)}</SelectField><Field name="quantity" type="number" min="1" label={nl?'Aantal':'Quantity'} required/>
    {kind==='transfer'&&<><Field name="source" label={nl?'Bron':'Source'} required/><Field name="destination" label={nl?'Bestemming':'Destination'} required/></>}
    {kind==='receive'&&<><Field name="reference" label={nl?'Inkoopreferentie':'Purchase reference'}/><Field name="supplier" label={nl?'Leverancier':'Supplier'}/><Field name="batchNumber" label={nl?'Batch/lot':'Batch / lot'}/><Field name="expirationDate" type="date" label={nl?'Vervaldatum':'Expiration date'}/><Field name="destination" label={nl?'Bestemming':'Destination'} required/></>}
    {kind==='issue'&&<><Field name="employee" label={nl?'Ontvanger':'Destination employee'}/><Field name="department" label={nl?'Afdeling':'Department'} required/><Field name="purpose" label={nl?'Doel':'Purpose'} required/></>}
    {kind==='return'&&<><Field name="reference" label={nl?'Oorspronkelijke uitgifte':'Original issue reference'} required/><SelectField name="condition" label={nl?'Conditie':'Condition'}><option>Usable</option><option>Damaged</option><option>Defective</option><option>Under inspection</option></SelectField></>}
    {kind==='correct'&&<><Field name="delta" type="number" label={nl?'Correctie (+/-)':'Adjustment (+/-)'} required/><SelectField name="correctionType" label={nl?'Correctietype':'Correction type'}>{['Count increase','Count decrease','Damage','Loss','Expiration','Found stock','Audit adjustment','Other'].map(x=><option key={x}>{x}</option>)}</SelectField></>}
    <TextAreaField className="wide" name="reason" label={nl?'Reden':'Reason'} required/><div className="wide"><MutationFeedback {...feedback}/><Button type="submit"><Icon/>{meta.title[nl?1:0]}</Button></div></form>
    <ConfirmDialog open={confirm} title={nl?'Voorraadwijziging bevestigen':'Confirm stock change'} description={nl?'Controleer artikel, aantal en verplichte reden.':'Review the item, quantity and required reason.'} confirmLabel={nl?'Bevestigen':'Confirm'} danger onClose={()=>setConfirm(false)} onConfirm={()=>execute(pending)}/></div></OfflineGate>
}
export const ReceiveStock=()=> <StockOperation kind="receive"/>;
export const IssueStock=()=> <StockOperation kind="issue"/>;
export const TransferStock=()=> <StockOperation kind="transfer"/>;
export const ReturnStock=()=> <StockOperation kind="return"/>;
export const CorrectStock=()=> <StockOperation kind="correct"/>;

export function Reservations(){
  const {language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),repository=useRepository(),[feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  async function act(action:WorkflowAction,id:string){const result=await repository.execute({action,entityId:id});setFeedback({status:result.ok?'success':'error',message:result.message})}
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const v:Record<string,unknown>=Object.fromEntries(new FormData(e.currentTarget));v.quantity=Number(v.quantity);const result=await repository.execute({action:'reservation.create',entityId:String(v.itemId),values:v});setFeedback({status:result.ok?'success':'error',message:result.message})}
  const cols:DataColumn<StockReservation>[]=[{id:'ref',label:nl?'Referentie':'Reference',render:x=>x.reference,text:x=>x.reference},{id:'item',label:nl?'Artikel':'Item',render:x=>x.itemName,text:x=>x.itemName},{id:'qty',label:nl?'Aantal':'Quantity',render:x=>`${x.fulfilledQuantity}/${x.quantity}`,text:x=>x.quantity},{id:'status',label:'Status',render:x=><Badge>{x.status}</Badge>,text:x=>x.status},{id:'actions',label:nl?'Acties':'Actions',render:x=><div className="actions">{x.status==='Pending'&&<Button onClick={()=>act('reservation.approve',x.id)}>{nl?'Goedkeuren':'Approve'}</Button>}{x.status==='Active'&&<><Button onClick={()=>act('reservation.fulfill',x.id)}>{nl?'Vervullen':'Fulfill'}</Button><Button variant="secondary" onClick={()=>act('reservation.release',x.id)}>{nl?'Vrijgeven':'Release'}</Button></>}</div>,text:()=>''}];
  return <OfflineGate><div className="page"><PageHeader title={nl?'Voorraadreserveringen':'Stock reservations'} description={nl?'Aanvragen, goedkeuren, vrijgeven en vervullen.':'Request, approve, release and fulfill stock.'}/><form className="card workflow-form" onSubmit={submit}><SelectField name="itemId" label={nl?'Artikel':'Item'} required><option value="">{nl?'Selecteer':'Select'}</option>{snapshot.inventory.map(x=><option value={x.id} key={x.id}>{x.name} ({availableStock(x)})</option>)}</SelectField><Field name="quantity" type="number" min="1" label={nl?'Aantal':'Quantity'} required/><Field name="beneficiary" label={nl?'Medewerker of afdeling':'Employee or department'} required/><Field name="purpose" label={nl?'Doel':'Purpose'} required/><Field name="requiredDate" type="date" label={nl?'Benodigd op':'Required date'} required/><Field name="expirationDate" type="date" label={nl?'Vervaldatum':'Expiration date'} required/><div className="wide"><MutationFeedback {...feedback}/><Button type="submit"><ShieldCheck/>{nl?'Aanvragen':'Request'}</Button></div></form><section className="card data-card"><DataTable id="reservations" rows={snapshot.reservations} columns={cols} rowKey={x=>x.id} searchPlaceholder={nl?'Zoek reserveringen…':'Search reservations…'} emptyTitle={nl?'Geen reserveringen':'No reservations'} emptyDescription={nl?'Maak de eerste aanvraag.':'Create the first request.'}/></section></div></OfflineGate>
}

export function LowStock(){
  const {language}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),rows=snapshot.inventory.filter(x=>availableStock(x)<=x.reorderLevel);
  const columns=[...itemColumns(nl),{id:'suggested',label:nl?'Advies':'Suggested reorder',render:(x:InventoryItem)=>reorderRecommendation(x),text:(x:InventoryItem)=>reorderRecommendation(x)}];
  return <OfflineGate><div className="page"><PageHeader title={nl?'Lage voorraad':'Low-stock control'} description={nl?'Mock-herbevoorradingsadviezen; er worden geen inkooporders gemaakt.':'Mock reorder recommendations; no purchase orders are created.'}/><section className="card data-card"><DataTable id="low-stock" rows={rows} columns={columns} rowKey={x=>x.id} searchPlaceholder={nl?'Zoek lage voorraad…':'Search low stock…'} emptyTitle={nl?'Geen tekorten':'No shortages'} emptyDescription={nl?'Alle voorraadniveaus zijn gezond.':'All stock levels are healthy.'}/></section></div></OfflineGate>
}

export function InventoryImport(){
  const {language}=useApp(),nl=language==='nl';const stages=nl?['Uploaden','Parseren','Kolommen koppelen','Valideren','Voorbeeld','Bevestigen','Vastleggen','Resultaat']:['Upload','Parse','Map columns','Validate','Preview','Confirm','Commit','Result report'];
  return <OfflineGate><div className="page"><PageHeader title={nl?'Voorraad importeren':'Import inventory'} description={nl?'Atomaire, gefaseerde mock-import. Ongeldige rijen worden niet vastgelegd.':'Atomic staged mock import. Invalid rows are not committed.'}/><ol className="card import-steps">{stages.map((x,i)=><li key={x}><b>{i+1}</b><span>{x}</span></li>)}</ol><section className="card"><h2>{nl?'Bestand uploaden':'Upload file'}</h2><Field name="file" type="file" accept=".csv,.xlsx" label={nl?'CSV- of Excel-bestand':'CSV or Excel file'}/><p className="muted">{nl?'Vereist: artikelcode, naam, categorie, eenheid, hoeveelheid, magazijn en opslagpositie.':'Required: item code, name, category, unit, quantity, warehouse and storage position.'}</p><Button disabled>{nl?'Bestand valideren':'Validate file'}</Button></section></div></OfflineGate>
}

export default InventoryList;
