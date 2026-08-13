import {Download,RefreshCw,WifiOff} from 'lucide-react';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
import {Button} from './ui';
import {useApp} from '../context/AppContext';

interface InstallPromptEvent extends Event{prompt():Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type PwaInstallContextValue={canInstall:boolean;isIos:boolean;isStandalone:boolean;install:()=>Promise<boolean>};
const PwaInstallContext=createContext<PwaInstallContextValue|null>(null);

export function PwaInstallProvider({children}:{children:ReactNode}){
  const [prompt,setPrompt]=useState<InstallPromptEvent|null>(null);
  const [isStandalone,setStandalone]=useState(()=>typeof window!=='undefined'&&((typeof window.matchMedia==='function'&&window.matchMedia('(display-mode: standalone)').matches)||('standalone' in navigator&&Boolean((navigator as Navigator&{standalone?:boolean}).standalone))));
  const isIos=typeof navigator!=='undefined'&&/iPad|iPhone|iPod/.test(navigator.userAgent);
  useEffect(()=>{const onPrompt=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)},onInstalled=()=>{setPrompt(null);setStandalone(true)};addEventListener('beforeinstallprompt',onPrompt);addEventListener('appinstalled',onInstalled);return()=>{removeEventListener('beforeinstallprompt',onPrompt);removeEventListener('appinstalled',onInstalled)}},[]);
  const install=useCallback(async()=>{if(!prompt)return false;await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);return choice.outcome==='accepted'},[prompt]);
  const value=useMemo(()=>({canInstall:!!prompt,isIos,isStandalone,install}),[prompt,isIos,isStandalone,install]);
  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(){const value=useContext(PwaInstallContext);if(!value)throw new Error('PwaInstallProvider missing');return value}

export function PwaInstallButton({children,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>){
  const pwa=usePwaInstall();
  if(pwa.isStandalone)return null;
  return <button {...props} type="button" className={`aims-glossy-button aims-install-button ${className}`.trim()} onClick={async event=>{props.onClick?.(event);if(!event.defaultPrevented)await pwa.install()}}><Download aria-hidden="true"/>{children}</button>;
}

export function PwaStatus(){
  const {language}=useApp(),nl=language==='nl',[online,setOnline]=useState(navigator.onLine),[update,setUpdate]=useState(false);
  useEffect(()=>{const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false),controller=()=>setUpdate(true);addEventListener('online',onOnline);addEventListener('offline',onOffline);navigator.serviceWorker?.addEventListener('controllerchange',controller);return()=>{removeEventListener('online',onOnline);removeEventListener('offline',onOffline);navigator.serviceWorker?.removeEventListener('controllerchange',controller)}},[]);
  if(!online)return <div className="pwa-banner offline" role="status"><WifiOff/><span><b>{nl?'Offline modus':'Offline mode'}</b>{nl?'Sommige functies zijn tijdelijk beperkt.':'Some functions are temporarily limited.'}</span></div>;
  if(update)return <div className="pwa-banner" role="status"><RefreshCw/><span><b>{nl?'Update beschikbaar':'Update available'}</b>{nl?'Herlaad om de nieuwe versie te activeren.':'Reload to activate the new version.'}</span><Button onClick={()=>location.reload()}>{nl?'Herlaad':'Reload'}</Button></div>;
  return null;
}
