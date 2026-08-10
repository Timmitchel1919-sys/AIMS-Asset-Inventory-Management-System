import {Check,Copy,Download,RefreshCw,Share2,Smartphone} from 'lucide-react';
import {useState} from 'react';
import {appDownloadConfig} from '../../config/appDownload.config';
import {useApp} from '../../context/AppContext';
import {usePwaInstall} from '../PwaStatus';
import {Button} from '../ui';

export function AppDeviceSettings(){
  const pwa=usePwaInstall(),{language}=useApp(),nl=language==='nl',[message,setMessage]=useState('');
  async function share(){const url=`${location.origin}${appDownloadConfig.publicDownloadPath}`;try{if(navigator.share)await navigator.share({title:appDownloadConfig.appName,url});else{await navigator.clipboard.writeText(url);setMessage(nl?'Downloadlink gekopieerd.':'Download link copied.')}}catch{setMessage(nl?'Delen is geannuleerd of mislukt.':'Sharing was cancelled or failed.')}}
  return <div className="app-device-settings">
    <div className="app-device-row"><Download/><div><strong>{nl?'Webapp installeren':'Install Web App'}</strong><span>{pwa.isStandalone?(nl?'App is al geïnstalleerd':'App already installed'):pwa.canInstall?(nl?'Installatie beschikbaar op dit apparaat.':'Installation is available on this device.'):pwa.isIos?(nl?'Gebruik Delen en daarna Zet op beginscherm in Safari.':'Use Share and then Add to Home Screen in Safari.'):(nl?'Installatie is niet beschikbaar in deze browser.':'Installation is unavailable in this browser.')}</span></div>{pwa.isStandalone?<span className="badge badge-success"><Check/>{nl?'Geïnstalleerd':'Installed'}</span>:pwa.canInstall?<Button variant="secondary" onClick={()=>pwa.install()}><Download/>{nl?'Installeren':'Install'}</Button>:pwa.isIos?<Button variant="secondary" onClick={pwa.showGuidance}>{nl?'Instructies':'Instructions'}</Button>:null}</div>
    <div className="app-device-row"><Smartphone/><div><strong>{nl?'Mobiele app-download':'Mobile App Download'}</strong><span>{appDownloadConfig.androidUrl||appDownloadConfig.iosUrl?(nl?'Officiële winkelopties zijn beschikbaar.':'Official store options are available.'):(nl?'Android- en iOS-winkelreleases volgen binnenkort.':'Android and iOS store releases are coming soon.')}</span></div><span className="badge badge-neutral">{nl?'Binnenkort':'Coming soon'}</span></div>
    <div className="app-device-row"><RefreshCw/><div><strong>{nl?'Huidige appversie':'Current App Version'}</strong><span>{appDownloadConfig.currentVersion}</span></div></div>
    <div className="app-device-row"><Smartphone/><div><strong>{nl?'Apparaatinformatie':'Device Information'}</strong><span>{navigator.platform||'Web'} · {pwa.isStandalone?'Standalone PWA':'Browser'}</span></div></div>
    <div className="app-device-row"><Share2/><div><strong>{nl?'AIMS-app delen':'Share AIMS App'}</strong><span>{nl?'Deel de officiële openbare downloadpagina.':'Share the official public download page.'}</span></div><Button variant="secondary" onClick={share}><Share2/>{nl?'Delen':'Share'}</Button></div>
    {message&&<p className="app-device-message" role="status"><Copy/>{message}</p>}
  </div>;
}
