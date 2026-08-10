import {Bell,Languages,Moon,User} from 'lucide-react';
import {Card} from '../components/ui';
import {PageHeader} from '../components/WorkflowUi';
import {useApp} from '../context/AppContext';

export function ProfilePage(){const{user}=useApp();return <div className="page"><PageHeader title="My Profile" description="Your personal AIMS account information."/><Card><div className="record-detail"><div><small>Name</small><strong>{user?.name}</strong></div><div><small>Role</small><strong>{user?.role}</strong></div><div><small>Account</small><strong>Active</strong></div></div></Card></div>}
export function PreferencesPage(){const{language,setLanguage}=useApp();return <div className="page"><PageHeader title="Preferences" description="Personal display and notification choices for your account."/><div className="admin-console-grid"><Card><User/><h2>Account</h2><p>Personal details and accessibility preferences.</p></Card><Card><Languages/><h2>Language</h2><button className="btn secondary" onClick={()=>setLanguage(language==='en'?'nl':'en')}>{language==='en'?'Switch to Dutch':'Switch to English'}</button></Card><Card><Moon/><h2>Appearance</h2><p>Theme selection remains available in the application theme control.</p></Card><Card><Bell/><h2>Notifications</h2><p>Choose the operational updates relevant to you.</p></Card></div></div>}
