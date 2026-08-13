import {Apple,Download,ExternalLink,Globe2,Mail,MonitorSmartphone,Smartphone} from 'lucide-react';
import {Link} from 'react-router-dom';
import {appDownloadConfig} from '../config/appDownload.config';
import {usePwaInstall} from '../components/PwaStatus';
import {useApp} from '../context/AppContext';
import '../styles/download-page.css';

export default function DownloadPage(){
  const pwa=usePwaInstall(),{language}=useApp(),nl=language==='nl';
  const installLabel=pwa.isStandalone?(nl?'App is al geïnstalleerd':'App already installed'):pwa.canInstall?(nl?'Webapp installeren':'Install Web App'):(nl?'Installatie niet beschikbaar':'Install unavailable');
  return <main className="download-page"><div className="download-page__shell">
    <header><Link to="/" aria-label={nl?'Terug naar startpagina':'Back to home'}><img src="/aims-logo.png" alt=""/><span>AIMS</span></Link><Link to="/login">{nl?'Aanmelden':'Sign In'}</Link></header>
    <section className="download-page__intro"><div><h1>{nl?'Download de AIMS-app':'Download the AIMS App'}</h1><p>{nl?'Installeer het Asset & Inventory Management System op een ondersteund apparaat voor snelle, responsieve toegang.':'Install the Asset & Inventory Management System on a supported device for fast, responsive access.'}</p><small>{nl?'Huidige versie':'Current version'} {appDownloadConfig.currentVersion}</small></div><MonitorSmartphone aria-hidden="true"/></section>
    <section className="download-options" aria-label={nl?'Downloadopties':'Download options'}>
      <article><Globe2/><h2>{nl?'Webapp':'Web App'}</h2><p>{nl?'Werkt in moderne browsers op desktop, tablet en mobiel.':'Works in modern browsers on desktop, tablet, and mobile.'}</p><button className="btn btn-primary" disabled={pwa.isStandalone||!pwa.canInstall} onClick={()=>pwa.install()}><Download/>{installLabel}</button></article>
      <article><Smartphone/><h2>Android</h2><p>{appDownloadConfig.androidUrl?(nl?'Download via de officiële winkel.':'Download from the official store.'):(nl?'Officiële Android-release binnenkort beschikbaar.':'Official Android release coming soon.')}</p>{appDownloadConfig.androidUrl?<a className="btn btn-secondary" href={appDownloadConfig.androidUrl} rel="noreferrer"><ExternalLink/>Google Play</a>:<span className="download-coming-soon">{nl?'Binnenkort':'Coming soon'}</span>}</article>
      <article><Apple/><h2>iPhone &amp; iPad</h2><p>{appDownloadConfig.iosUrl?(nl?'Download via de officiële winkel.':'Download from the official store.'):(nl?'Officiële iOS-release binnenkort beschikbaar.':'Official iOS release coming soon.')}</p>{appDownloadConfig.iosUrl?<a className="btn btn-secondary" href={appDownloadConfig.iosUrl} rel="noreferrer"><ExternalLink/>App Store</a>:<span className="download-coming-soon">{nl?'Binnenkort':'Coming soon'}</span>}</article>
    </section>
    <footer><p>{nl?'Ondersteuning nodig?':'Need help?'}</p><a href={`mailto:${appDownloadConfig.supportEmail}`}><Mail/>{appDownloadConfig.supportEmail}</a><nav><Link to="/terms">{nl?'Algemene voorwaarden':'Terms & Conditions'}</Link><Link to="/privacy">{nl?'Privacyverklaring':'Privacy Notice'}</Link><Link to="/support">{nl?'ICT-ondersteuning':'ICT Support'}</Link></nav></footer>
  </div></main>;
}
