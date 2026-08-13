import {Check,ChevronRight,Copy,ExternalLink,Mail,ShieldAlert} from 'lucide-react';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {legalConfig,legalVersions} from '../../config/legal';
import {useApp} from '../../context/AppContext';

export function LegalPrivacySettings(){
  const{user}=useApp(),[copied,setCopied]=useState(false);
  async function copyEmail(){await navigator.clipboard.writeText(legalConfig.privacyEmail);setCopied(true);setTimeout(()=>setCopied(false),1800)}
  return <div className="legal-settings">
    <div className="legal-settings__documents">
      <Link to="/terms"><div><h3>Terms &amp; Conditions</h3><p>Rules for authorized use of the AIMS Asset &amp; Inventory Management System.</p><small>Version {legalVersions.termsVersion} · Effective {legalConfig.effectiveDate} · Updated {legalConfig.lastUpdated}</small></div><ChevronRight/></Link>
      <Link to="/privacy"><div><h3>Privacy Notice</h3><p>How KCS handles personal, technical, asset, and transaction information.</p><small>Version {legalVersions.privacyVersion} · Effective {legalConfig.effectiveDate} · Updated {legalConfig.lastUpdated}</small></div><ChevronRight/></Link>
      <Link to="/support"><div><h3>Privacy and Security Contact</h3><p>{legalConfig.privacyEmail}<br/>{legalConfig.phone}</p></div><ChevronRight/></Link>
    </div>
    <section className="legal-contact-card"><h3>ICT Support – Kangoeroe School</h3><a href={`mailto:${legalConfig.privacyEmail}`}><Mail/>Send email</a><button onClick={copyEmail}>{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy email address'}</button><a href={`mailto:${legalConfig.privacyEmail}?subject=Privacy%20Concern`}><ShieldAlert/>Report privacy concern</a><a href={`mailto:${legalConfig.privacyEmail}?subject=Security%20Incident`}><ShieldAlert/>Report security incident</a></section>
    <section className="policy-information"><h3>Policy Information</h3><dl><div><dt>Terms &amp; Conditions version</dt><dd>{legalVersions.termsVersion}</dd></div><div><dt>Privacy Notice version</dt><dd>{legalVersions.privacyVersion}</dd></div><div><dt>Effective date</dt><dd>{legalConfig.effectiveDate}</dd></div><div><dt>Last updated</dt><dd>{legalConfig.lastUpdated}</dd></div><div><dt>AI provider</dt><dd>{legalConfig.aiProvider}</dd></div></dl></section>
    {user&&<section className="legal-admin-summary"><h3>IT policy management</h3><p>Version 1.0 is published. Historical published versions are preserved and immutable. Future material changes follow draft → pending approval → approved → published and may require acknowledgement.</p><div><span>Terms 1.0 <b>Published</b></span><span>Privacy 1.0 <b>Published</b></span></div></section>}
    <section className="system-information"><h3>System Information</h3><dl><div><dt>System</dt><dd>{legalConfig.systemName}</dd></div><div><dt>Organization</dt><dd>{legalConfig.organizationName}</dd></div><div><dt>Application version</dt><dd>0.1.0</dd></div><div><dt>Website</dt><dd><a href={legalConfig.website}>{legalConfig.website}<ExternalLink/></a></dd></div></dl><p>{legalConfig.copyright}<br/>{legalConfig.developerCredit}</p></section>
  </div>;
}
