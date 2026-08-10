import {
  Activity,Archive,BarChart3,Bell,Bot,Boxes,Building2,ChevronDown,ChevronLeft,ClipboardCheck,
  ClipboardList,FolderTree,LayoutDashboard,LogOut,MapPin,Menu,Mic,PackageOpen,SlidersHorizontal,User,
  PanelLeftClose,Recycle,RotateCcw,Send,Settings,Shield,ShieldCheck,
  ToolCase,Users,Warehouse,Wrench,X,type LucideIcon
} from 'lucide-react';
import {NavLink,useLocation,useNavigate} from 'react-router-dom';
import {useState,type FormEvent,type ReactNode} from 'react';
import {useApp} from '../context/AppContext';
import {can} from '../auth/permissions';
import {matchRoute,navRoutes,type RouteIcon} from '../routes/manifest';
import {useT} from '../i18n';
import {PwaStatus} from './PwaStatus';
import {useMockSnapshot,useRepository} from '../data/mockRepository';
import {GlobalSearch} from './search/GlobalSearch';
import {AimsLogo} from './branding/AimsLogo';

type VoiceRecognition={
  lang:string;
  interimResults:boolean;
  start:()=>void;
  onresult?:((event:{results:{[index:number]:{[index:number]:{transcript:string}}}})=>void);
  onend?:(()=>void);
  onerror?:(()=>void);
};
type VoiceRecognitionConstructor=new()=>VoiceRecognition;

const icons:Record<RouteIcon,LucideIcon>={
  dashboard:LayoutDashboard,assets:Boxes,inventory:Warehouse,categories:FolderTree,
  locations:MapPin,departments:Building2,assignments:Archive,borrow:RotateCcw,
  forms:ClipboardList,repairs:Wrench,maintenance:ToolCase,movements:PackageOpen,
  audits:ClipboardCheck,reports:BarChart3,notifications:Bell,assistant:Bot,users:Users,
  admin:Shield,roles:ShieldCheck,activity:Activity,disposals:Recycle,settings:Settings,install:PackageOpen
};

export function AppShell({children}:{children:ReactNode}){
  const app=useApp(),t=useT(),location=useLocation(),navigate=useNavigate(),snapshot=useMockSnapshot(),repository=useRepository();
  const presentationMode=import.meta.env.VITE_APP_MODE==='presentation';
  const [assistantOpen,setAssistantOpen]=useState(false),[assistantQuery,setAssistantQuery]=useState(''),[listening,setListening]=useState(false),[voiceStatus,setVoiceStatus]=useState(''),[profileOpen,setProfileOpen]=useState(false);
  const [assistantMessages,setAssistantMessages]=useState<{who:'bot'|'you';text:string}[]>([{who:'bot',text:app.language==='nl'?'Waarmee kan ik helpen?':'How can I help with your inventory?'}]);
  if(!app.user)return null;
  const routes=navRoutes.filter(route=>can(app.user?.role,route.permission));
  const primaryBase=routes.filter(route=>!['assistant','notifications','admin','disposals'].includes(route.id));
  const disposalRoute=routes.find(route=>route.id==='disposals');
  const reportsIndex=primaryBase.findIndex(route=>route.id==='reports');
  const primaryRoutes=[...primaryBase];
  if(disposalRoute)primaryRoutes.splice(reportsIndex+1,0,disposalRoute);
  const assistantEnabled=routes.some(route=>route.id==='assistant');
  const unreadNotificationCount=snapshot.notifications.filter(notification=>!notification.read&&!notification.dismissed).length;
  const canAccessAdmin=can(app.user.role,'admin.access');
  const current=matchRoute(location.pathname);
  function askAssistant(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const value=assistantQuery.trim();
    if(!value)return;
    const lower=value.toLowerCase();
    let response:string;
    if((lower.includes('repair')||lower.includes('repar'))&&can(app.user?.role,'repairs.manage'))response=app.language==='nl'?`${snapshot.repairs.length} reparatierecords zijn beschikbaar.`:`${snapshot.repairs.length} repair records are available.`;
    else if((lower.includes('stock')||lower.includes('voorraad'))&&can(app.user?.role,'inventory.view'))response=app.language==='nl'?`${snapshot.inventory.filter(item=>item.onHand-item.reserved<item.minimum).length} artikelen hebben lage voorraad.`:`${snapshot.inventory.filter(item=>item.onHand-item.reserved<item.minimum).length} items have low stock.`;
    else response=app.language==='nl'?'De gevraagde gegevens zijn niet beschikbaar voor uw rol of in de huidige mockdataset.':'The requested data is unavailable for your role or in the current mock dataset.';
    setAssistantMessages(messages=>[...messages,{who:'you',text:value},{who:'bot',text:response}]);
    setAssistantQuery('');
  }
  function startVoiceInput(){
    const voiceWindow=window as typeof window&{SpeechRecognition?:VoiceRecognitionConstructor;webkitSpeechRecognition?:VoiceRecognitionConstructor};
    const Recognition=voiceWindow.SpeechRecognition||voiceWindow.webkitSpeechRecognition;
    if(!Recognition){setVoiceStatus(app.language==='nl'?'Spraakinvoer wordt niet ondersteund in deze browser.':'Voice input is not supported in this browser.');return}
    const recognition=new Recognition();
    recognition.lang=app.language==='nl'?'nl-NL':'en-US';
    recognition.interimResults=false;
    recognition.onresult=event=>{setAssistantQuery(event.results[0][0].transcript);setVoiceStatus(app.language==='nl'?'Spraak vastgelegd.':'Voice captured.')};
    recognition.onend=()=>setListening(false);
    recognition.onerror=()=>{setListening(false);setVoiceStatus(app.language==='nl'?'Spraak kon niet worden herkend.':'Voice could not be recognized.')};
    setVoiceStatus(app.language==='nl'?'Luisteren…':'Listening…');
    setListening(true);
    recognition.start();
  }
  return <div className={`app ${app.sidebarCollapsed?'collapsed':''}`}>
    <a className="skip-link" href="#main-content">{app.language==='nl'?'Naar hoofdinhoud':'Skip to main content'}</a>
    {app.mobileOpen&&<button className="scrim" aria-label={t('common.closeNavigation')} onClick={()=>app.setMobileOpen(false)}/>}
    <aside className={`sidebar app-sidebar ${app.sidebarCollapsed?'app-sidebar--collapsed':''} ${app.mobileOpen?'open':''}`} aria-label={t('common.primaryNavigation')}>
      <header className="brand app-sidebar__header">
        <button type="button" className={`brand-mark app-sidebar__logo-button ${app.sidebarCollapsed?'brand-expand':''}`} aria-label={app.sidebarCollapsed?'Expand sidebar':'AIMS Asset & Inventory Management System'} title={app.sidebarCollapsed?'Expand sidebar':'AIMS Asset & Inventory Management System'} aria-expanded={!app.sidebarCollapsed} onClick={()=>{if(app.sidebarCollapsed)app.setSidebarCollapsed(false)}}><AimsLogo context="authenticated" surface="dark" alt=""/></button>
        <div className="brand-copy app-sidebar__brand-text"><strong>AIMS</strong><span>Asset &amp; Inventory System</span></div>
        {!app.sidebarCollapsed&&<button type="button" className="sidebar-collapse-button app-sidebar__collapse-button" title="Collapse sidebar" aria-label="Collapse sidebar" aria-expanded="true" onClick={()=>app.setSidebarCollapsed(true)}><PanelLeftClose aria-hidden="true"/></button>}
        <button type="button" className="mobile-close" aria-label={t('common.closeNavigation')} onClick={()=>app.setMobileOpen(false)}><X/></button>
      </header>
      <nav>{primaryRoutes.map(route=>{
        const Icon=icons[route.icon!],label=t(route.navKey!);
        return <span className="sidebar-route" key={route.id}>{route.id==='admin'&&<span className="sidebar-section-label">{app.language==='nl'?'Beheer':'Administration'}</span>}<NavLink to={route.path} title={app.sidebarCollapsed?label:undefined} aria-label={app.sidebarCollapsed?label:undefined} onClick={()=>app.setMobileOpen(false)}>
          <span className="navigation-item__icon" aria-hidden="true"><Icon/></span><span className="navigation-item__label">{label}</span>
          {route.id==='notifications'&&unreadNotificationCount>0&&<b className="nav-count">{unreadNotificationCount}</b>}
        </NavLink></span>;
      })}{assistantEnabled&&<NavLink to="/assistant" title={app.sidebarCollapsed?t('nav.assistant'):undefined} aria-label={app.sidebarCollapsed?t('nav.assistant'):undefined} onClick={()=>app.setMobileOpen(false)}><span className="navigation-item__icon" aria-hidden="true"><Bot/></span><span className="navigation-item__label">{t('nav.assistant')}</span></NavLink>}</nav>
      <div className="sidebar-foot">
        {canAccessAdmin&&<NavLink className="sidebar-admin-link" to="/admin" title={app.sidebarCollapsed?'Admin':undefined} aria-label={app.sidebarCollapsed?'Admin':undefined} onClick={()=>app.setMobileOpen(false)}><Shield aria-hidden="true"/><span className="sidebar-action-label">Admin</span></NavLink>}
        <button type="button" title={app.sidebarCollapsed?t('common.logout'):undefined} aria-label={app.sidebarCollapsed?t('common.logout'):undefined} onClick={()=>{app.logout();navigate('/login')}}><LogOut aria-hidden="true"/><span className="sidebar-action-label">{t('common.logout')}</span></button>
      </div>
    </aside>
    <header className="topbar">
      <GlobalSearch/>
      <div className="top-actions">
        <button className="top-notifications" aria-label={`${t('nav.notifications')}: ${unreadNotificationCount}`} onClick={()=>navigate('/notifications')}><Bell/>{unreadNotificationCount>0&&<span>{unreadNotificationCount}</span>}</button>
        <div className="profile-menu-wrap"><button className="top-user" aria-label={app.language==='nl'?'Profielmenu openen':'Open profile menu'} aria-expanded={profileOpen} aria-haspopup="menu" onClick={()=>setProfileOpen(value=>!value)}><span className="avatar">{app.user.initials}</span><ChevronDown aria-hidden="true"/></button>{profileOpen&&<div className="profile-menu" role="menu"><header><strong>{app.user.name}</strong><small>{app.user.role}</small></header><button role="menuitem" onClick={()=>{navigate('/profile');setProfileOpen(false)}}><User/>My Profile</button><button role="menuitem" onClick={()=>{navigate('/preferences');setProfileOpen(false)}}><SlidersHorizontal/>Preferences</button><button role="menuitem" onClick={()=>{app.logout();navigate('/login')}}><LogOut/>Sign Out</button></div>}</div>
      </div>
    </header>
    <main className="main" id="main-content" tabIndex={-1}>
      {presentationMode&&<section className="presentation-strip" aria-label={app.language==='nl'?'Presentatieomgeving':'Presentation environment'}>
        <div><strong>{app.language==='nl'?'Presentatieomgeving':'Presentation environment'}</strong><span>{app.language==='nl'?'Fictieve demonstratiegegevens · gesimuleerde authenticatie · geen permanente database':'Fictional demonstration data · simulated authentication · no permanent database'}</span></div>
        <div className="presentation-account"><span>{app.language==='nl'?'Demo-account':'Demo account'}</span><select aria-label={app.language==='nl'?'Demo-account':'Demo account'} value={app.user.role} onChange={event=>app.login(event.target.value as typeof app.user.role,false)}>
          <option value="administrator">Administrator</option><option value="warehouse-manager">Inventory Manager</option><option value="ict-staff">Technician</option><option value="auditor">Auditor</option><option value="management">Department Manager</option><option value="warehouse-staff">Read-only demonstration</option>
        </select></div>
        <button className="btn secondary" onClick={()=>{if(confirm(app.language==='nl'?'Herstel de exacte demonstratiegegevens?':'Restore the exact demonstration dataset?'))repository.reset()}}><RotateCcw/>{app.language==='nl'?'Demo resetten':'Reset demo data'}</button>
      </section>}
      <div className="breadcrumb"><ChevronLeft size={14}/><span>{current?t(current.titleKey):'AIMS Asset & Inventory Management System'}</span></div>
      <PwaStatus/>
      {children}
      {location.pathname.startsWith('/assistant')&&<p className="assistant-privacy-notice">{app.language==='nl'?'Voer geen wachtwoorden, authenticatiecodes of zeer gevoelige persoonsgegevens in.':'Do not enter passwords, authentication codes, or highly sensitive personal information.'} <a href="/privacy">{app.language==='nl'?'Privacyverklaring':'Privacy Notice'}</a></p>}
    </main>
    <nav className="bottom-nav" aria-label={t('common.mobileNavigation')}>
      {routes.filter(route=>['dashboard','assets','inventory','audits'].includes(route.id)).map(route=>{const Icon=icons[route.icon!];return <NavLink key={route.id} to={route.path}><Icon/><span>{t(route.navKey!)}</span></NavLink>})}
      <button onClick={()=>app.setMobileOpen(true)}><Menu/><span>{t('common.more')}</span></button>
    </nav>
    {assistantEnabled&&assistantOpen&&<div className="floating-assistant open">
      {assistantOpen&&<section className="assistant-panel" aria-label={t('nav.assistant')}>
        <header><span><Bot/>{t('nav.assistant')}</span><button aria-label={app.language==='nl'?'Assistent sluiten':'Close assistant'} onClick={()=>setAssistantOpen(false)}><X/></button></header>
        <div className="assistant-panel-chat" aria-live="polite">{assistantMessages.map((message,index)=><div key={index} className={`assistant-panel-message ${message.who}`}>{message.text}</div>)}</div>
        {voiceStatus&&<small className="voice-status">{voiceStatus}</small>}
        <form onSubmit={askAssistant}>
          <input value={assistantQuery} onChange={event=>setAssistantQuery(event.target.value)} placeholder={app.language==='nl'?'Stel een vraag…':'Ask a question…'}/>
          <button type="button" className={listening?'listening':''} aria-label={app.language==='nl'?'Spraakinvoer':'Voice input'} title={app.language==='nl'?'Spraakinvoer':'Voice input'} onClick={startVoiceInput}><Mic/></button>
          <button type="submit" aria-label={app.language==='nl'?'Versturen':'Send'}><Send/></button>
        </form>
      </section>}
    </div>}
  </div>;
}
