import {AlertTriangle,ArrowLeft,CheckCircle2,X} from 'lucide-react';
import {useEffect,useId,useRef,type FormEvent,type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button,State} from './ui';
import {useApp} from '../context/AppContext';
import {requestAccountMenuOpen} from '../lib/accountMenu';

export function PageHeader({title,description,actions}:{title:string;description:string;actions?:ReactNode}){
  return <header className="page-title"><div><h1>{title}</h1><p>{description}</p></div>{actions&&<div className="actions">{actions}</div>}</header>;
}

export function AccountBackButton(){
  const navigate=useNavigate(),{language}=useApp();
  return <button type="button" className="back account-back" onClick={()=>{requestAccountMenuOpen();navigate(-1)}}><ArrowLeft/>{language==='nl'?'Terug':'Back'}</button>;
}

export function Dialog({open,title,description,children,onClose,footer}:{open:boolean;title:string;description?:string;children:ReactNode;onClose:()=>void;footer?:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open]);
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose()}} onClose={()=>{if(open)onClose()}}>
    <header><div><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div><button className="icon-button" aria-label="Close" onClick={onClose}><X/></button></header>
    <div className="dialog-body">{children}</div>
    {footer&&<footer>{footer}</footer>}
  </dialog>;
}

export function ConfirmDialog({open,title,description,confirmLabel,onConfirm,onClose,danger=false}:{open:boolean;title:string;description:string;confirmLabel:string;onConfirm:()=>void|Promise<void>;onClose:()=>void;danger?:boolean}){
  const {language}=useApp();
  return <Dialog open={open} title={title} description={description} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>{language==='nl'?'Annuleren':'Cancel'}</Button><Button variant={danger?'danger':'primary'} onClick={async()=>{await onConfirm();onClose()}}>{confirmLabel}</Button></>}>
    <div className="confirm-message"><AlertTriangle/><p>{language==='nl'?'Controleer de gevolgen voordat u doorgaat. Deze mockactie wordt vastgelegd in het activiteitenlogboek.':'Review the impact before continuing. This mock action will be recorded in the activity log.'}</p></div>
  </Dialog>;
}

export function MutationFeedback({status,message}:{status:'idle'|'loading'|'success'|'error';message:string}){
  if(status==='idle')return null;
  return <div className={`mutation-feedback ${status}`} role={status==='error'?'alert':'status'} aria-live="polite">{status==='loading'?<span className="spinner"/>:status==='success'?<CheckCircle2/>:<AlertTriangle/>}<span>{message}</span></div>;
}

export function OfflineGate({children}:{children:ReactNode}){
  const {language}=useApp();
  if(typeof navigator!=='undefined'&&!navigator.onLine)return <State type="offline" title={language==='nl'?'U bent offline':'You are offline'} description={language==='nl'?'De applicatieshell is beschikbaar, maar mockmutaties zijn uitgeschakeld totdat de verbinding is hersteld.':'The application shell is available, but mock mutations are disabled until the connection is restored.'}/>;
  return children;
}

export function FormShell({onSubmit,children}:{onSubmit:(event:FormEvent<HTMLFormElement>)=>void;children:ReactNode}){
  return <form className="workflow-form" onSubmit={onSubmit} noValidate>{children}</form>;
}
