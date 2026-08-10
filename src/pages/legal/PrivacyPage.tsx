import {LegalPageLayout} from '../../components/legal/LegalPageLayout';
import {legalVersions} from '../../config/legal';
import {privacySections} from '../../content/legal';
import {privacySectionsNl} from '../../content/legal.nl';
import {useApp} from '../../context/AppContext';
export default function PrivacyPage(){const{language}=useApp(),nl=language==='nl';return <LegalPageLayout title={nl?'Privacyverklaring':'Privacy Notice'} version={legalVersions.privacyVersion} sections={nl?privacySectionsNl:privacySections}/>}
