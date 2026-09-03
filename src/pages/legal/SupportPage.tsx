import {ExternalLink,Mail,ShieldAlert} from 'lucide-react';
import {Link} from 'react-router-dom';
import {legalConfig} from '../../config/legal';
import {AIMS_LOGO_ALT,AIMS_LOGO_SRC} from '../../branding/aimsLogo';
import {useApp} from '../../context/AppContext';
import '../../styles/legal.css';

export default function SupportPage(){
  const{language}=useApp(),nl=language==='nl';
  return <main className="legal-page support-page"><div className="legal-page__container">
    <header className="legal-page__header"><Link className="legal-page__back" to="/login">← {nl?'Terug':'Back'}</Link><img className="legal-page__logo" src={AIMS_LOGO_SRC.blue} alt={AIMS_LOGO_ALT}/><p className="legal-page__eyebrow">{legalConfig.systemName}</p><h1>{nl?'ICT-ondersteuning, privacy en beveiliging':'ICT Support, Privacy & Security'}</h1><p>{nl?'Neem contact op met de KCS ICT-afdeling voor technische ondersteuning, privacyvragen, individuele verzoeken of vermoedelijke beveiligingsincidenten.':'Contact the KCS ICT Department for technical support, privacy questions, individual requests, or suspected security incidents.'}</p></header>
    <section className="support-contact"><ShieldAlert/><div><h2>{nl?'ICT-ondersteuning – Kangoeroe School':'ICT Support – Kangoeroe School'}</h2><a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a><a href={`tel:${legalConfig.phone.replace(/\s/g,'')}`}>{legalConfig.phone}</a></div></section>
    <div className="support-actions"><a href={`mailto:${legalConfig.privacyEmail}?subject=AIMS%20ICT%20Support`}><Mail/>{nl?'ICT-ondersteuning aanvragen':'Request ICT support'}</a><a href={`mailto:${legalConfig.privacyEmail}?subject=Privacy%20Concern`}><ShieldAlert/>{nl?'Privacykwestie melden':'Report privacy concern'}</a><a href={`mailto:${legalConfig.privacyEmail}?subject=Security%20Incident`}><ShieldAlert/>{nl?'Beveiligingsincident melden':'Report security incident'}</a><a href={legalConfig.website}><ExternalLink/>{nl?'Officiële website':'Official website'}</a></div>
    <section className="legal-section"><h2>{nl?'Afhandeling van incidenten':'Incident handling'}</h2><p>{nl?'Meldingen worden beoordeeld door de ICT Manager, Head of Planning and Coordinator of the ICT Department, systeembeheerder of een andere aangewezen ICT-medewerker. Ernstige incidenten worden geëscaleerd naar de schooldirecteur. KCS heeft geen afzonderlijke privacyfunctionaris aangesteld.':'Reports are assessed by the ICT Manager, Head of Planning and Coordinator of the ICT Department, system administrator, or another designated ICT employee. Serious incidents are escalated to the school director. KCS has not appointed a separate privacy officer.'}</p></section>
    <footer className="legal-page__contact"><p>{legalConfig.copyright}<br/>{legalConfig.developerCredit}</p><div><Link to="/terms">{nl?'Algemene voorwaarden':'Terms & Conditions'}</Link><Link to="/privacy">{nl?'Privacyverklaring':'Privacy Notice'}</Link></div></footer>
  </div></main>;
}
