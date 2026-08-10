import {LegalPageLayout} from '../../components/legal/LegalPageLayout';
import {legalVersions} from '../../config/legal';
import {termsSections} from '../../content/legal';
import {termsSectionsNl} from '../../content/legal.nl';
import {useApp} from '../../context/AppContext';
export default function TermsPage(){const{language}=useApp(),nl=language==='nl';return <LegalPageLayout title={nl?'Algemene voorwaarden':'Terms & Conditions'} version={legalVersions.termsVersion} sections={nl?termsSectionsNl:termsSections}/>}
