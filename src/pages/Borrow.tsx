import {Check,FileCheck2,PackageCheck,Plus,RotateCcw,ThumbsDown,X} from 'lucide-react';
import {useMemo,useState,type FormEvent} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {Button,Field,SelectField,TextAreaField} from '../components/ui';
import {DataTable,type DataColumn} from '../components/DataTable';
import {ConfirmDialog,Dialog,MutationFeedback,OfflineGate,PageHeader} from '../components/WorkflowUi';
import {useApp} from '../context/AppContext';
import type {BorrowRecord} from '../domain/types';
import {useMockSnapshot,useRepository} from '../data/repositoryContext';
import {StatusBadge} from '../components/AssetStatusBadge';

export default function BorrowPage({overdue=false}:{overdue?:boolean}={}){
  const {language,formatAuto,formatDate}=useApp(),nl=language==='nl',snapshot=useMockSnapshot(),repository=useRepository(),navigate=useNavigate(),params=useParams();
  const routeId=params.borrowId||params.id;
  const [selected,setSelected]=useState<BorrowRecord|null>(()=>snapshot.borrows.find(item=>item.id===routeId)||null);
  const [create,setCreate]=useState(location.pathname.endsWith('/new')),[action,setAction]=useState<string|null>(null),[preview,setPreview]=useState<'agreement'|'receipt'|null>(null);
  const [feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  const rows=useMemo(()=>snapshot.borrows.map(item=>item.status==='Issued'&&new Date(item.dueDate)<new Date()?{...item,status:'Overdue' as const}:item),[snapshot.borrows]);
  const displayRows=overdue?rows.filter(item=>item.status==='Overdue'):rows;
  const columns:DataColumn<BorrowRecord>[]=[
    {id:'reference',label:nl?'Referentie':'Reference',render:item=><strong>{item.reference}</strong>,text:item=>item.reference,sortable:true},
    {id:'asset',label:nl?'Middel':'Asset',render:item=>item.asset,text:item=>item.asset},
    {id:'code',label:'Inv.code',render:item=>item.assetCode,text:item=>item.assetCode,sortable:true},
    {id:'borrower',label:nl?'Lener':'Borrower',render:item=>item.borrower,text:item=>item.borrower,sortable:true},
    {id:'department',label:nl?'Afdeling':'Department',render:item=>item.department,text:item=>item.department},
    {id:'due',label:nl?'Vervaldatum':'Due date',render:item=>item.dueDate,text:item=>item.dueDate,sortable:true},
    {id:'status',label:'Status',render:item=><StatusBadge status={item.status} size="compact" variant="table"/>,text:item=>item.status}
  ];
  async function createRequest(event:FormEvent<HTMLFormElement>){event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());setFeedback({status:'loading',message:nl?'Verzoek aanmakenâ€¦':'Creating requestâ€¦'});const result=await repository.execute({action:'borrow.create',entityId:String(values.assetId),values});setFeedback({status:result.ok?'success':'error',message:result.message});if(result.ok)setTimeout(()=>{setCreate(false);setSelected(snapshot.borrows.find(item=>item.id===result.entityId)||null);navigate(`/borrow/${result.entityId}`)},350)}
  async function perform(){
    if(!selected||!action)return;
    const map={approve:'borrow.approve',reject:'borrow.reject',issue:'borrow.issue',return:'borrow.return',cancel:'borrow.cancel'} as const;
    const result=await repository.execute({action:map[action as keyof typeof map],entityId:selected.id,values:{condition:(document.querySelector('[name="returnCondition"]') as HTMLSelectElement)?.value,borrowerSignature:'Mock borrower signature',staffSignature:'Mock staff signature'}});
    setFeedback({status:result.ok?'success':'error',message:result.message});setSelected(snapshot.borrows.find(item=>item.id===selected.id)||selected);setAction(null);
  }
  const current=selected?rows.find(item=>item.id===selected.id)||selected:null;
  const actions=current?current.status==='Pending Approval'?['approve','reject','cancel']:current.status==='Approved'?['issue','cancel']:['Issued','Overdue','Partially Returned'].includes(current.status)?['return']:[]:[];
  return <OfflineGate><div className="page">
    <PageHeader title={overdue?(nl?'Achterstallige middelen':'Overdue equipment'):(nl?'Uitleenbeheer':'Borrow management')} description={nl?'Beheer verzoeken, goedkeuring, uitgifte, retouren en achterstallige middelen.':'Manage requests, approval, issue, returns and overdue equipment.'} actions={<Button onClick={()=>setCreate(true)}><Plus/>{nl?'Verzoek maken':'Create request'}</Button>}/>
    <section className="card data-card"><DataTable id="borrows" rows={displayRows} columns={columns} rowKey={item=>item.id} searchPlaceholder={nl?'Zoek uitleenrecordsâ€¦':'Search borrow recordsâ€¦'} emptyTitle={nl?'Geen uitleenrecords':'No borrow records'} emptyDescription={nl?'Maak het eerste uitleenverzoek.':'Create the first borrow request.'} onRowClick={setSelected}/></section>
    <Dialog open={create} title={nl?'Uitleenverzoek maken':'Create borrow request'} description={nl?'Alleen beschikbare middelen kunnen worden aangevraagd.':'Only available assets can be requested.'} onClose={()=>{setCreate(false);if(location.pathname.endsWith('/new'))navigate('/borrow')}}><form className="workflow-form" onSubmit={createRequest}><SelectField name="assetId" label={nl?'Beschikbaar middel':'Available asset'} required>{snapshot.assets.filter(asset=>asset.status==='Available').map(asset=><option key={asset.id} value={asset.id}>{asset.code} â€” {asset.name}</option>)}</SelectField><Field name="borrower" label={nl?'Lener':'Borrower'} required/><Field name="department" label={nl?'Afdeling':'Department'} required/><Field name="dueDate" type="date" label={nl?'Vervaldatum':'Due date'} required/><SelectField name="condition" label={nl?'Conditie bij uitgifte':'Condition at issue'}><option>Excellent</option><option>Good</option><option>Fair</option></SelectField><TextAreaField name="notes" className="wide" label={nl?'Notities':'Notes'}/><div className="wide"><MutationFeedback {...feedback}/><Button type="submit"><FileCheck2/>{nl?'Verzoek indienen':'Submit request'}</Button></div></form></Dialog>
    <Dialog open={!!current} title={current?.reference||''} description={current?`${current.assetCode} â€” ${current.asset}`:''} onClose={()=>{setSelected(null);if(params.id)navigate('/borrow')}}>{current&&<><div className="record-detail">{Object.entries({[nl?'Lener':'Borrower']:current.borrower,[nl?'Afdeling':'Department']:current.department,[nl?'Uitgiftedatum':'Issue date']:current.borrowDate,[nl?'Vervaldatum':'Due date']:current.dueDate,[nl?'Conditie uitgifte':'Issue condition']:current.condition,[nl?'Conditie retour':'Return condition']:current.returnCondition||'â€”',Status:current.status}).map(([label,value])=><div key={label}><small>{label}</small><strong>{formatAuto(value)}</strong></div>)}</div><div className="actions">{actions.map(value=><Button key={value} variant={value==='reject'||value==='cancel'?'danger':'primary'} onClick={()=>setAction(value)}>{value==='approve'?<Check/>:value==='reject'?<ThumbsDown/>:value==='issue'?<PackageCheck/>:value==='return'?<RotateCcw/>:<X/>}{value}</Button>)}<Button variant="secondary" onClick={()=>setPreview(current.status==='Returned'?'receipt':'agreement')}>{current.status==='Returned'?(nl?'Retourbewijs':'Return receipt'):(nl?'Overeenkomst':'Agreement')}</Button></div><MutationFeedback {...feedback}/></>}</Dialog>
    <ConfirmDialog open={!!action} title={`${nl?'Bevestig':'Confirm'} ${action||''}`} description={nl?'Deze statuswijziging wordt vastgelegd en werkt het gekoppelde middel bij.':'This status change is logged and updates the related asset.'} confirmLabel={nl?'Bevestigen':'Confirm'} danger={action==='reject'||action==='cancel'} onClose={()=>setAction(null)} onConfirm={perform}/>
    <Dialog open={!!preview} title={preview==='receipt'?(nl?'Retourbewijs':'Return receipt'):(nl?'Uitleenovereenkomst':'Borrow agreement')} description={current?.reference} onClose={()=>setPreview(null)}><div className="print-preview"><header><strong>AIMS Asset & Inventory Management System</strong><h2>{preview==='receipt'?'Return receipt':'Equipment loan agreement'}</h2></header><p><b>{current?.borrower}</b> â€” {current?.department}</p><p>{current?.assetCode} Â· {current?.asset}</p><p>{current?.borrowDate?formatDate(current.borrowDate):current?.borrowDate} â†’ {current?.dueDate?formatDate(current.dueDate):current?.dueDate}</p><p>{nl?'Handtekening lener':'Borrower signature'}: {current?.borrowerSignature||'________________'}</p><p>{nl?'Handtekening medewerker':'Staff signature'}: {current?.staffSignature||'________________'}</p><footer><span>{nl?'Schoolinformatie: officiÃ«le gegevens nog niet geleverd':'School information: official details not supplied'}</span><span>1 / 1</span></footer></div></Dialog>
  </div></OfflineGate>;
}

export const BorrowOverduePage = () => <BorrowPage overdue />;
