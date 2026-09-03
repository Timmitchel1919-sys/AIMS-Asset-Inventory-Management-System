import type {ReactNode} from 'react';
import {ArrowLeft,Printer} from 'lucide-react';
import {Link,useNavigate} from 'react-router-dom';
import {legalConfig} from '../../config/legal';
import {AIMS_LOGO_ALT,AIMS_LOGO_SRC} from '../../branding/aimsLogo';
import type {LegalSection} from '../../types/legal.types';
import {useApp} from '../../context/AppContext';
import '../../styles/legal.css';
import {PrintAuditHeader} from '../PrintAuditHeader';

export function LegalPageLayout({title,version,sections,children}:{title:string;version:string;sections:LegalSection[];children?:ReactNode}){
  const navigate=useNavigate(),{language}=useApp(),nl=language==='nl';
  return <div className="legal-page"><PrintAuditHeader/><div className="legal-page__container">
    <header className="legal-page__header">
      <div className="legal-page__actions"><button onClick={()=>navigate(-1)}><ArrowLeft/>{nl?'Terug':'Back'}</button><button onClick={()=>window.print()}><Printer/>{nl?'Afdrukken / opslaan als PDF':'Print / Save PDF'}</button></div>
      <img className="legal-page__logo" src={AIMS_LOGO_SRC.blue} alt={AIMS_LOGO_ALT}/>
      <p className="legal-page__eyebrow">{legalConfig.systemName}</p><h1>{title}</h1><p>{legalConfig.organizationName}</p>
      <div className="legal-page__meta"><span>{nl?'Versie':'Version'} {version}</span><span>{nl?'Ingangsdatum':'Effective date'}: {legalConfig.effectiveDate}</span><span>{nl?'Laatst bijgewerkt':'Last updated'}: {legalConfig.lastUpdated}</span></div>
    </header>
    <nav className="legal-page__contents" aria-label={`${title} ${nl?'inhoud':'contents'}`}><strong>{nl?'Inhoud':'Contents'}</strong>{sections.map(section=><a key={section.id} href={`#${section.id}`}><span>{section.number}.</span>{section.title}</a>)}</nav>
    <main><article className="legal-page__content">{sections.map(section=><section className="legal-section" id={section.id} key={section.id}><h2><span>{section.number}.</span>{section.title}</h2>{section.paragraphs?.map(paragraph=><p key={paragraph}>{paragraph}</p>)}{section.bulletPoints&&<ul>{section.bulletPoints.map(item=><li key={item}>{item}</li>)}</ul>}{section.table&&<div className="legal-table-wrap"><table><thead><tr>{section.table.headers.map(header=><th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{section.table.rows.map(row=><tr key={row[0]}>{row.map((cell,index)=>index===0?<th scope="row" key={cell}>{cell}</th>:<td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>}{section.id==='retention'&&children}</section>)}</article></main>
    <footer className="legal-page__contact"><h2>{nl?'Officieel contact':'Official contact'}</h2><address><strong>{legalConfig.organizationName}</strong>{legalConfig.addressLines.map(line=><span key={line}>{line}</span>)}<a href={`tel:${legalConfig.phone.replace(/\s/g,'')}`}>{legalConfig.phone}</a><a href={`mailto:${legalConfig.generalEmail}`}>{legalConfig.generalEmail}</a><a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a><a href={legalConfig.website}>{legalConfig.website}</a></address><p>{legalConfig.copyright}<br/>{legalConfig.developerCredit}</p><div><Link to="/terms">{nl?'Algemene voorwaarden':'Terms & Conditions'}</Link><Link to="/privacy">{nl?'Privacyverklaring':'Privacy Notice'}</Link><Link to="/support">{nl?'ICT-ondersteuning':'ICT Support'}</Link></div></footer>
  </div></div>;
}
