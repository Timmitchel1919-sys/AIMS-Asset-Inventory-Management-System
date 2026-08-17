import {ArrowLeft,Check,Download,FileSpreadsheet,MapPin,Printer,Upload,UserRound} from 'lucide-react';
import {useState,type FormEvent} from 'react';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {QRCodeSVG} from 'qrcode.react';
import {useAssetT,type AssetCopyKey} from '../assetCopy';
import {Button,Card,Field,Loader,SelectField,State,TextAreaField} from '../components/ui';
import {ConfirmDialog,MutationFeedback,OfflineGate,PageHeader} from '../components/WorkflowUi';
import {useApp} from '../context/AppContext';
import {useMockSnapshot,useRepository} from '../data/repositoryContext';
import {isAssignmentEligible,labelPayload,parseAssetImport,validateAssetMovement,type ImportRow} from '../domain/assetManagement';
import {normalizeAssetCode} from '../domain/assetCode';
import type {Asset} from '../domain/types';
import {useT} from '../i18n';

const importErrorKeys:Record<string,[AssetCopyKey,AssetCopyKey]>={
  MISSING_REQUIRED:['missingRequired','missingRequiredFix'],INVALID_CODE:['invalidCode','invalidCodeFix'],DUPLICATE_CODE:['duplicateCode','duplicateCodeFix'],
  DUPLICATE_SERIAL:['duplicateSerial','duplicateSerialFix'],INVALID_CATEGORY:['invalidCategory','invalidCategoryFix'],INVALID_LOCATION:['invalidLocation','invalidLocationFix'],
  INVALID_DEPARTMENT:['invalidDepartment','invalidDepartmentFix']
};

function useCurrentAsset(){
  const params=useParams(),id=params.assetId||params.id,snapshot=useMockSnapshot();
  return{asset:snapshot.assets.find(item=>item.id===id),snapshot,id};
}
function AssetState({asset,children}:{asset?:Asset;children:(asset:Asset)=>React.ReactNode}){
  const [params]=useSearchParams(),a=useAssetT(),navigate=useNavigate();
  if(params.get('state')==='loading')return <Loader/>;
  if(params.get('state')==='error')return <State type="error" title={a('submissionFailed')} description={a('notFoundHelp')} action={<Button onClick={()=>navigate(-1)}>{a('retry')}</Button>}/>;
  if(!asset)return <State type="error" title={a('notFound')} description={a('notFoundHelp')} action={<Button onClick={()=>navigate('/assets')}>{a('back')}</Button>}/>;
  return children(asset);
}
function AssetPage({title,description,asset,children,actions}:{title:string;description:string;asset:Asset;children:React.ReactNode;actions?:React.ReactNode}){
  const a=useAssetT(),navigate=useNavigate();
  return <OfflineGate><div className="page asset-workflow-page"><button className="back" onClick={()=>navigate(`/assets/${asset.id}`)}><ArrowLeft/>{a('back')}</button><PageHeader title={title} description={description} actions={actions}/>{children}</div></OfflineGate>;
}

export function AssetHistory(){
  const {asset,snapshot}=useCurrentAsset(),a=useAssetT();
  const [type,setType]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[user,setUser]=useState(''),[expanded,setExpanded]=useState('');
  return <AssetState asset={asset}>{current=>{
    const records=[
      {id:`created-${current.id}`,type:'creation',date:current.dateAdded||current.purchaseDate,user:current.createdBy||'Naomi Williams',detail:`${current.code} · ${current.name}`,before:'—',after:current.status},
      ...snapshot.activity.filter(item=>item.entityId===current.id).map(item=>({id:item.id,type:item.action,date:item.at,user:item.user,detail:item.detail,before:'Recorded asset state',after:item.result})),
      ...snapshot.movements.filter(item=>item.assetCode===current.code).map(item=>({id:item.id,type:item.type,date:item.date,user:item.by,detail:`${item.from} → ${item.to}${item.reason?` · ${item.reason}`:''}`,before:item.from,after:item.to})),
      ...snapshot.assignments.filter(item=>item.assetId===current.id).map(item=>({id:item.id,type:item.active?'assignment':'return',date:item.returnedAt||item.assignedAt,user:item.assignee,detail:item.notes||item.department,before:item.conditionAtIssue,after:item.active?'Active':item.conditionAtReturn||'Returned'})),
      ...snapshot.borrows.filter(item=>item.assetCode===current.code).map(item=>({id:item.id,type:'borrow',date:item.borrowDate,user:item.borrower,detail:`${item.reference} · ${item.status}`,before:item.condition,after:item.returnCondition||item.status})),
      ...snapshot.repairs.filter(item=>item.assetCode===current.code).map(item=>({id:item.id,type:'repair',date:item.received,user:item.technician,detail:`${item.reference} · ${item.issue}`,before:'Reported',after:item.status})),
      ...snapshot.maintenance.filter(item=>item.assetCode===current.code).map(item=>({id:item.id,type:'maintenance',date:item.nextDate,user:item.assignee,detail:item.type,before:'Scheduled',after:item.status})),
      ...snapshot.audits.filter(item=>item.frozenItemIds?.includes(current.id)).map(item=>({id:item.id,type:'audit',date:item.deadline,user:item.assignee,detail:`${item.reference} · ${item.name}`,before:item.scope,after:item.status})),
      ...snapshot.disposals.filter(item=>item.assetId===current.id).map(item=>({id:item.id,type:'disposal',date:item.requestedAt,user:item.requestedBy,detail:item.reason,before:current.condition,after:item.status}))
    ].sort((left,right)=>right.date.localeCompare(left.date));
    const filtered=records.filter(item=>(!type||item.type===type)&&(!from||item.date>=from)&&(!to||item.date<=`${to}T23:59`)&&(!user||item.user===user));
    return <AssetPage asset={current} title={a('historyTitle')} description={`${current.code} · ${current.name}`} actions={<Button variant="secondary" onClick={()=>window.print()}><Printer/>{a('print')}</Button>}>
      <Card><div className="history-filters"><SelectField label={a('eventType')} value={type} onChange={event=>setType(event.target.value)}><option value="">{a('all')}</option>{[...new Set(records.map(item=>item.type))].map(value=><option key={value}>{value}</option>)}</SelectField><Field label={a('dateFrom')} type="date" value={from} onChange={event=>setFrom(event.target.value)}/><Field label={a('dateTo')} type="date" value={to} onChange={event=>setTo(event.target.value)}/><SelectField label={a('user')} value={user} onChange={event=>setUser(event.target.value)}><option value="">{a('all')}</option>{[...new Set(records.map(item=>item.user))].map(value=><option key={value}>{value}</option>)}</SelectField></div></Card>
      <ol className="asset-history-timeline">{filtered.map(item=><li key={item.id}><button aria-expanded={expanded===item.id} onClick={()=>setExpanded(value=>value===item.id?'':item.id)}><span>{item.type}</span><strong>{item.detail}</strong><small>{item.date} · {item.user}</small></button>{expanded===item.id&&<dl><div><dt>{a('before')}</dt><dd>{item.before}</dd></div><div><dt>{a('after')}</dt><dd>{item.after}</dd></div></dl>}</li>)}</ol>{!filtered.length&&<State type="empty" title={a('emptyHistory')} description={a('emptyHistory')}/>}
    </AssetPage>;
  }}</AssetState>;
}

export function AssetAssignment(){
  const {asset}=useCurrentAsset(),a=useAssetT(),t=useT(),repository=useRepository(),app=useApp(),navigate=useNavigate();
  const [feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  async function submit(event:FormEvent<HTMLFormElement>,current:Asset){event.preventDefault();const form=new FormData(event.currentTarget);if(!isAssignmentEligible(current)){setFeedback({status:'error',message:a('assignmentBlocked')});return}setFeedback({status:'loading',message:a('loading')});const result=await repository.execute({action:'assignment.create',entityId:current.id,actor:app.user?.name,values:Object.fromEntries(form)});setFeedback({status:result.ok?'success':'error',message:result.message});if(result.ok)setTimeout(()=>navigate(`/assets/${current.id}/history`),400)}
  return <AssetState asset={asset}>{current=><AssetPage asset={current} title={a('assignmentTitle')} description={`${current.code} · ${current.name}`}><Card><form className="workflow-form" onSubmit={event=>submit(event,current)}><Field name="assignee" label={a('person')} required/><Field name="department" label={a('department')} defaultValue={current.department} required/><Field name="location" label={a('location')} defaultValue={current.location} required/><Field name="assignedAt" type="date" label={a('assignmentDate')} defaultValue={new Date().toISOString().slice(0,10)} required/><Field name="expectedReturn" type="date" label={a('expectedEnd')}/><SelectField name="condition" label={a('condition')} defaultValue={current.condition}>{['New','Excellent','Good','Fair','Poor','Defective'].map(value=><option key={value} value={value}>{t(`condition.${value}`)}</option>)}</SelectField><TextAreaField name="notes" label={a('notes')}/><Field name="signature" label={a('signature')} defaultValue="Mock signature captured"/><Field name="assignedBy" label={a('assignedBy')} value={app.user?.name||''} readOnly/><div className="form-actions wide"><Button type="submit" disabled={feedback.status==='loading'}><UserRound/>{a('confirm')}</Button></div></form><MutationFeedback {...feedback}/>{!isAssignmentEligible(current)&&<State type="error" title={a('assignmentBlocked')} description={a('assignmentBlocked')}/>}</Card></AssetPage>}</AssetState>;
}

export function AssetMovement(){
  const {asset}=useCurrentAsset(),a=useAssetT(),repository=useRepository(),app=useApp(),navigate=useNavigate();
  const [confirm,setConfirm]=useState(false),[values,setValues]=useState<Record<string,string>>({}),[feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  function prepare(event:FormEvent<HTMLFormElement>,current:Asset){event.preventDefault();const next=Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>;const validation=validateAssetMovement(current,next.destinationLocation,next.destinationDepartment);if(!validation.ok){setFeedback({status:'error',message:validation.message});return}setValues(next);setConfirm(true)}
  async function commit(current:Asset){setFeedback({status:'loading',message:a('loading')});const result=await repository.execute({action:'asset.move',entityId:current.id,actor:app.user?.name,values});setFeedback({status:result.ok?'success':'error',message:result.message});if(result.ok)setTimeout(()=>navigate(`/assets/${current.id}/history`),400)}
  return <AssetState asset={asset}>{current=><AssetPage asset={current} title={a('movementTitle')} description={`${current.code} · ${current.name}`}><Card><form className="workflow-form" onSubmit={event=>prepare(event,current)}><Field label={a('currentLocation')} value={current.location} readOnly/><Field name="destinationLocation" label={a('destinationLocation')} required/><Field label={a('currentDepartment')} value={current.department} readOnly/><Field name="destinationDepartment" label={a('destinationDepartment')} required/><Field name="reason" label={a('movementReason')} required/><Field name="date" type="date" label={a('movementDate')} defaultValue={new Date().toISOString().slice(0,10)}/><Field name="responsible" label={a('responsible')} required/><Field name="approvedBy" label={a('approval')}/><TextAreaField className="wide" name="notes" label={a('notes')}/><Field className="wide" name="attachments" label={a('attachments')}/><div className="form-actions wide"><Button type="submit"><MapPin/>{a('confirm')}</Button></div></form><MutationFeedback {...feedback}/></Card><ConfirmDialog open={confirm} title={a('movementTitle')} description={`${current.location} → ${values.destinationLocation||''}`} confirmLabel={a('confirm')} onClose={()=>setConfirm(false)} onConfirm={()=>commit(current)}/></AssetPage>}</AssetState>;
}

export function AssetLabels(){
  const {asset}=useCurrentAsset(),a=useAssetT();
  const [size,setSize]=useState('standard'),[copies,setCopies]=useState(1);
  const download=(current:Asset)=>{const content=`KCS ASSET LABEL\n${current.code}\n${current.name}\n${current.serialNumber}\n${labelPayload(current)}`;const url=URL.createObjectURL(new Blob([content],{type:'text/plain'})),link=document.createElement('a');link.href=url;link.download=`${current.code}-label.txt`;link.click();URL.revokeObjectURL(url)};
  return <AssetState asset={asset}>{current=><AssetPage asset={current} title={a('labelsTitle')} description={`${current.code} · ${a('secureRoute')}`} actions={<Button onClick={()=>window.print()}><Printer/>{a('print')}</Button>}><Card><div className="label-controls"><SelectField label={a('labelSize')} value={size} onChange={event=>setSize(event.target.value)}><option value="compact">{a('compact')}</option><option value="standard">{a('standard')}</option></SelectField><Field label={a('copies')} type="number" min="1" max="20" value={copies} onChange={event=>setCopies(Number(event.target.value))}/><Button variant="secondary" onClick={()=>download(current)}><Download/>{a('download')}</Button></div><div className="label-sheet">{Array.from({length:copies},(_,index)=><article className={`asset-label ${size}`} key={index}><div className="brand-placeholder">KCS</div><QRCodeSVG aria-label={`${a('labels')}: ${current.code}`} value={labelPayload(current)} size={96}/><div><b>{current.code}</b><strong>{current.name}</strong><small>{a('serial')}: {current.serialNumber}</small><div className="barcode-preview" role="img" aria-label={`${a('barcode')}: ${current.barcode||current.code}`}>|||| || | |||| | | |||</div><small>{current.barcode||current.code}</small></div></article>)}</div></Card></AssetPage>}</AssetState>;
}

export function AssetDisposal(){
  const {asset}=useCurrentAsset(),a=useAssetT(),repository=useRepository(),app=useApp(),navigate=useNavigate();
  const [values,setValues]=useState<Record<string,string>>({}),[confirm,setConfirm]=useState(false),[feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  async function commit(current:Asset){setFeedback({status:'loading',message:a('loading')});const result=await repository.execute({action:'disposal.create',entityId:current.id,actor:app.user?.name,values});setFeedback({status:result.ok?'success':'error',message:result.message});if(result.ok)setTimeout(()=>navigate(`/assets/${current.id}`),400)}
  return <AssetState asset={asset}>{current=><AssetPage asset={current} title={a('disposalTitle')} description={a('disposalHelp')}><Card><form className="workflow-form" onSubmit={event=>{event.preventDefault();setValues(Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>);setConfirm(true)}}><Field name="reason" label={a('disposalReason')} required/><Field label={a('condition')} value={current.condition} readOnly/><Field label={a('status')} value={current.status} readOnly/><TextAreaField name="technicalAssessment" label={a('assessment')} required/><Field name="estimatedValue" type="number" min="0" label={a('estimatedValue')}/><SelectField name="method" label={a('method')}><option>Recycling</option><option>Donation</option><option>Secure destruction</option><option>Sale</option></SelectField><TextAreaField name="notes" label={a('notes')}/><Field name="attachments" label={a('attachments')}/><div className="form-actions wide"><Button type="submit">{a('confirm')}</Button></div></form><MutationFeedback {...feedback}/></Card><ConfirmDialog open={confirm} title={a('disposalTitle')} description={a('disposalHelp')} confirmLabel={a('confirm')} danger onClose={()=>setConfirm(false)} onConfirm={()=>commit(current)}/></AssetPage>}</AssetState>;
}

const sample='code,name,serialnumber,category,location,department,brand,model\nKCSMD01,Imported laptop,IMP-001,Laptops,ICT Store,ICT,Dell,Latitude';
export function AssetImport(){
  const a=useAssetT(),repository=useRepository(),snapshot=useMockSnapshot(),navigate=useNavigate(),app=useApp();
  const [text,setText]=useState(sample),[rows,setRows]=useState<ImportRow[]>([]),[stage,setStage]=useState(1),[feedback,setFeedback]=useState<{status:'idle'|'loading'|'success'|'error';message:string}>({status:'idle',message:''});
  const valid=rows.filter(row=>!row.errors.length),invalid=rows.filter(row=>row.errors.length);
  const parse=()=>{const parsed=parseAssetImport(text,snapshot.assets,{categories:['Laptops','Printers','Projectors','Network switches','UPS devices','Tablets'],locations:['ICT Store','Warehouse','Server Room','Classroom 12','Staff Room'],departments:['ICT','Administration','Languages','Warehouse']});setRows(parsed.map(row=>({...row,errors:row.errors.map(error=>{const keys=importErrorKeys[error.type];return keys?{...error,explanation:a(keys[0]),recommendation:a(keys[1])}:error})})));setStage(4)};
  async function commit(){setStage(6);setFeedback({status:'loading',message:a('loading')});for(const row of valid){const normalized=normalizeAssetCode(row.normalized||'');if(!normalized)continue;const values=row.values||{};const result=await repository.execute({action:'asset.create',actor:app.user?.name,values:{codePrefix:normalized.codePrefix,codeNumber:normalized.codeNumber,name:values.name,serialNumber:values.serialnumber,category:values.category,location:values.location,department:values.department,brand:values.brand,model:values.model}});if(!result.ok){setFeedback({status:'error',message:result.message});return}}setStage(7);setFeedback({status:'success',message:`${a('importSuccess')}: ${valid.length}`})}
  return <OfflineGate><div className="page asset-import-page"><button className="back" onClick={()=>navigate('/assets')}><ArrowLeft/>{a('back')}</button><PageHeader title={a('importTitle')} description={`${a('upload')} → ${a('parse')} → ${a('validate')} → ${a('preview')} → ${a('confirm')} → ${a('commit')} → ${a('result')}`}/><div className="import-steps" aria-label={a('importTitle')}>{[a('upload'),a('parse'),a('validate'),a('preview'),a('confirm'),a('commit'),a('result')].map((label,index)=><span className={stage>=index+1?'active':''} key={label}>{index+1}. {label}</span>)}</div><Card><TextAreaField label={a('csvInput')} value={text} onChange={event=>setText(event.target.value)} rows={8}/><label className="field"><span>{a('upload')}</span><input type="file" accept=".csv,.xls,.xlsx" onChange={event=>{const file=event.target.files?.[0];if(file)file.text().then(setText)}}/></label><Button onClick={parse}><Upload/>{a('parseFile')}</Button></Card>{rows.length>0&&<><div className="status-summary"><Card><b>{valid.length}</b><small>{a('validRows')}</small></Card><Card><b>{invalid.length}</b><small>{a('invalidRows')}</small></Card></div><Card><div className="table-scroll"><table><thead><tr><th>{a('sourceRow')}</th><th>{a('submitted')}</th><th>{a('normalized')}</th><th>{a('errorType')}</th><th>{a('explanation')}</th><th>{a('recommendation')}</th></tr></thead><tbody>{rows.flatMap(row=>row.errors.length?row.errors.map((error,index)=><tr key={`${row.row}-${index}`}><td>{row.row}</td><td>{row.submitted}</td><td>{row.normalized||'—'}</td><td>{error.type}</td><td>{error.explanation}</td><td>{error.recommendation}</td></tr>):[<tr key={row.row}><td>{row.row}</td><td>{row.submitted}</td><td>{row.normalized}</td><td><Check/></td><td>{a('success')}</td><td>—</td></tr>])}</tbody></table></div><div className="form-actions"><Button onClick={commit} disabled={!valid.length||invalid.length>0}><FileSpreadsheet/>{a('commitValid')}</Button></div><MutationFeedback {...feedback}/></Card></>}</div></OfflineGate>;
}
