import {Download,RefreshCw,WifiOff,X} from 'lucide-react';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
import {Button} from './ui';
import {useApp} from '../context/AppContext';

interface InstallPromptEvent extends Event{prompt():Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type PwaInstallContextValue={canInstall:boolean;isIos:boolean;isStandalone:boolean;install:()=>Promise<boolean>;showGuidance:()=>void;dialogOpen:boolean;closeDialog:()=>void};
const PwaInstallContext=createContext<PwaInstallContextValue|null>(null);

export function PwaInstallProvider({children}:{children:ReactNode}){
  const [prompt,setPrompt]=useState<InstallPromptEvent|null>(null);
  const [dialogOpen,setDialogOpen]=useState(false);
  const [isStandalone,setStandalone]=useState(()=>typeof window!=='undefined'&&((typeof window.matchMedia==='function'&&window.matchMedia('(display-mode: standalone)').matches)||('standalone' in navigator&&Boolean((navigator as Navigator&{standalone?:boolean}).standalone))));
  const isIos=typeof navigator!=='undefined'&&/iPad|iPhone|iPod/.test(navigator.userAgent);
  useEffect(()=>{const onPrompt=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)},onInstalled=()=>{setPrompt(null);setDialogOpen(false);setStandalone(true)};addEventListener('beforeinstallprompt',onPrompt);addEventListener('appinstalled',onInstalled);return()=>{removeEventListener('beforeinstallprompt',onPrompt);removeEventListener('appinstalled',onInstalled)}},[]);
  const install=useCallback(async()=>{if(!prompt){setDialogOpen(true);return false}await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);return choice.outcome==='accepted'},[prompt]);
  const value=useMemo(()=>({canInstall:!!prompt,isIos,isStandalone,install,showGuidance:()=>setDialogOpen(true),dialogOpen,closeDialog:()=>setDialogOpen(false)}),[prompt,isIos,isStandalone,install,dialogOpen]);
  return <PwaInstallContext.Provider value={value}>{children}<PwaInstallDialog/></PwaInstallContext.Provider>;
}

export function usePwaInstall(){const value=useContext(PwaInstallContext);if(!value)throw new Error('PwaInstallProvider missing');return value}

export function PwaInstallButton({children,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>){
  const pwa=usePwaInstall();
  if(pwa.isStandalone)return null;
  return <button {...props} type="button" className={`aims-glossy-button aims-install-button ${className}`.trim()} onClick={async event=>{props.onClick?.(event);if(event.defaultPrevented)return;if(pwa.canInstall)await pwa.install();else pwa.showGuidance()}}><Download aria-hidden="true"/>{children}</button>;
}

export function PwaInstallDialog(){
  const pwa=useContext(PwaInstallContext),{language}=useApp();
  if(!pwa?.dialogOpen)return null;
  const nl=language==='nl';
  return <div className="aims-install-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)pwa.closeDialog()}}><section className="aims-install-dialog" role="dialog" aria-modal="true" aria-labelledby="aims-install-title"><button className="aims-dialog-close" onClick={pwa.closeDialog} aria-label={nl?'Sluiten':'Close'}><X/></button><Download aria-hidden="true"/><h2 id="aims-install-title">{nl?'Installeer AIMS':'Install AIMS'}</h2><p>{pwa.isIos?(nl?'Open het deelmenu in Safari en kies ‘Zet op beginscherm’.':'Open Safari’s Share menu and choose “Add to Home Screen”.'):(nl?'Open het menu van uw browser en kies ‘App installeren’ of ‘Toevoegen aan startscherm’.':'Open your browser menu and choose “Install app” or “Add to Home screen”.')}</p><button className="aims-glossy-button" onClick={pwa.closeDialog}>{nl?'Begrepen':'Got it'}</button></section></div>;
}

export function PwaStatus(){
  const {language}=useApp(),nl=language==='nl',[online,setOnline]=useState(navigator.onLine),[update,setUpdate]=useState(false);
  useEffect(()=>{const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false),controller=()=>setUpdate(true);addEventListener('online',onOnline);addEventListener('offline',onOffline);navigator.serviceWorker?.addEventListener('controllerchange',controller);return()=>{removeEventListener('online',onOnline);removeEventListener('offline',onOffline);navigator.serviceWorker?.removeEventListener('controllerchange',controller)}},[]);
  if(!online)return <div className="pwa-banner offline" role="status"><WifiOff/><span><b>{nl?'Offline modus':'Offline mode'}</b>{nl?'Sommige functies zijn tijdelijk beperkt.':'Some functions are temporarily limited.'}</span></div>;
  if(update)return <div className="pwa-banner" role="status"><RefreshCw/><span><b>{nl?'Update beschikbaar':'Update available'}</b>{nl?'Herlaad om de nieuwe versie te activeren.':'Reload to activate the new version.'}</span><Button onClick={()=>location.reload()}>{nl?'Herlaad':'Reload'}</Button></div>;
  return null;
}
