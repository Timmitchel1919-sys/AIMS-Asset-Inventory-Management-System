import{useEffect,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{CircleHelp,Clock,Headphones,Mail,ShieldAlert,Ticket,X}from'lucide-react';
import{KCS_ICT_SUPPORT_CONTACTS,KCS_ICT_SUPPORT_EMAIL,KCS_ICT_TICKET_TARGET}from'../../config/ictSupport';
import{ictSupportCopy,ictSupportHours}from'../../i18n/ictSupport';
import'../../styles/ict-support-dialog.css';

export function IctSupportDialog({language}:{language:'en'|'nl'}){
 const[open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDivElement>(null),c=ictSupportCopy[language];
 useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null,returnFocus=trigger.current||previous,root=dialog.current;document.body.classList.add('support-dialog-open');root?.querySelector<HTMLElement>('button,a')?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);return}if(event.key!=='Tab'||!root)return;const items=[...root.querySelectorAll<HTMLElement>('button,a[href]')].filter(x=>!x.hasAttribute('disabled'));if(!items.length)return;const first=items[0],last=items.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.classList.remove('support-dialog-open');returnFocus?.focus()}},[open]);
 const modal=<div className="ict-support-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><div ref={dialog} className="ict-support-dialog" role="dialog" aria-modal="true" aria-labelledby="ict-support-title">
  <header><div><Headphones/><h2 id="ict-support-title">{c.title}</h2></div><button type="button" className="ict-support-close" aria-label={c.close} onClick={()=>setOpen(false)}><X/></button></header>
  <div className="ict-support-body">
   <section className="ict-ticket-notice" role="alert" aria-labelledby="ticket-first-title"><Ticket/><div><h3 id="ticket-first-title"><strong>{c.ticketFirst}</strong></h3><p>{c.ticketExplanation}</p><a className="ict-ticket-button" href={KCS_ICT_TICKET_TARGET}><Ticket/>{c.ticketAction}</a><small>{c.simulated}</small></div></section>
   <div className="ict-support-summary"><section><Clock/><div><h3>{c.hoursTitle}</h3><p>{ictSupportHours[language]}</p></div></section><section><Mail/><div><h3>{c.general}</h3><a href={`mailto:${KCS_ICT_SUPPORT_EMAIL}?subject=KCS%20Inventory%20Support%20%E2%80%93%20Ticket%20%5Bticket%20number%5D`}>{KCS_ICT_SUPPORT_EMAIL}</a><p>{c.internalLine}</p></div></section></div>
   <section className="ict-support-order"><h3>{c.priorityTitle}</h3><ol>{c.priority.map(item=><li key={item}>{item}</li>)}</ol><strong>{c.ticketNumber}</strong></section>
   <section><h3>{c.categoriesTitle}</h3><ul className="ict-support-categories">{c.categories.map(item=><li key={item}>{item}</li>)}</ul></section>
   <section><h3>{c.directory}</h3><div className="ict-contact-grid">{KCS_ICT_SUPPORT_CONTACTS.map(contact=><article key={contact.id}><div><strong>{contact.name}</strong><span>{c.active}</span></div>{contact.role&&<p>{contact.role}</p>}<a href={`mailto:${contact.email}?subject=KCS%20Inventory%20Support%20%E2%80%93%20Ticket%20%5Bticket%20number%5D`}>{contact.email}</a></article>)}</div></section>
   <section className="ict-security-notice" role="note" aria-labelledby="security-title"><ShieldAlert/><div><h3 id="security-title">{c.securityTitle}</h3><p>{c.security}</p></div></section>
  </div>
 </div></div>;
 return <><button ref={trigger} type="button" className="ict-support-trigger" onClick={()=>setOpen(true)}><CircleHelp/>{c.trigger}</button>{open&&createPortal(modal,document.body)}</>;
}
