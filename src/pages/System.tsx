import {CloudOff,Home,WifiOff} from 'lucide-react';
import {Navigate,useNavigate} from 'react-router-dom';
import {Button,Card,State} from '../components/ui';
import {useApp} from '../context/AppContext';

export function Offline(){const{language}=useApp(),nl=language==='nl';return <div className="system-page"><Card><State type="offline" title={nl?'U bent offline':'You are offline'} description={nl?'De gecachte applicatieshell blijft beschikbaar. Mockmutaties zijn beperkt en worden niet duurzaam gesynchroniseerd.':'The cached application shell remains available. Mock mutations are limited and are not durably synchronized.'} action={<Button onClick={()=>history.back()}>{nl?'Gecachte werkruimte bekijken':'View cached workspace'}</Button>}/><div className="sync-items"><span><CloudOff/>{nl?'Geen duurzame synchronisatiewachtrij':'No durable synchronization queue'}</span><span><WifiOff/>{nl?'Herstel na opnieuw verbinden ondersteund':'Recovery after reconnect supported'}</span></div></Card></div>}
export function Forbidden(){const navigate=useNavigate(),{language}=useApp(),nl=language==='nl';return <div className="system-page"><Card><State type="permission" title={nl?'Toestemming vereist':'Permission required'} description={nl?'Uw huidige rol heeft geen toegang tot deze module. Er zijn geen gegevens gewijzigd.':'Your current role cannot access this module. No data was changed.'} action={<Button onClick={()=>navigate('/dashboard')}><Home/>{nl?'Terug naar dashboard':'Return to dashboard'}</Button>}/></Card></div>}
export function NotFound(){const navigate=useNavigate(),{language}=useApp(),nl=language==='nl';return <div className="system-page"><Card><State type="error" title={nl?'Record of pagina niet gevonden':'Record or page not found'} description={nl?'Het adres is mogelijk onjuist of het record is gearchiveerd.':'The address may be incorrect or the record may have been archived.'} action={<Button onClick={()=>navigate('/dashboard')}><Home/>{nl?'Terug naar dashboard':'Return to dashboard'}</Button>}/></Card></div>}
export const LegacyUsersRedirect=()=> <Navigate to="/admin/users" replace/>;
export const LegacyRolesRedirect=()=> <Navigate to="/admin/roles-permissions" replace/>;
export const LegacyActivityRedirect=()=> <Navigate to="/admin/activity-log" replace/>;
export const LegacyDisposalRedirect=()=> <Navigate to="/admin/disposal" replace/>;
export const LegacySettingsRedirect=()=> <Navigate to="/admin/settings" replace/>;
