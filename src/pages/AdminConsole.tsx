import {Activity,AlertTriangle,Recycle,ShieldCheck,UserCheck,UserX,Users} from 'lucide-react';
import {Link} from 'react-router-dom';
import {PageHeader} from '../components/WorkflowUi';
import {useApp} from '../context/AppContext';
import {useMockSnapshot} from '../data/mockRepository';

const modules=[
  {title:'Users',description:'Accounts, access status, roles, and recent sign-ins.',to:'/admin/users',icon:Users},
  {title:'Roles & Permissions',description:'Role capabilities and approval boundaries.',to:'/admin/roles-permissions',icon:ShieldCheck},
  {title:'Activity Log',description:'Read-only administrative and system history.',to:'/admin/activity-log',icon:Activity},
];

export default function AdminConsole(){
  const{language}=useApp(),snapshot=useMockSnapshot(),nl=language==='nl';
  const metrics=[
    {label:'Active users',value:snapshot.users.filter(item=>item.status==='Active').length,icon:UserCheck},
    {label:'Disabled users',value:snapshot.users.filter(item=>item.status!=='Active').length,icon:UserX},
    {label:'Roles configured',value:snapshot.roles.length,icon:ShieldCheck},
    {label:'Recent admin actions',value:snapshot.activity.slice(0,10).length,icon:Activity},
    {label:'Pending disposal requests',value:snapshot.disposals.filter(item=>!['Rejected','Completed','Permanently Archived'].includes(item.status)).length,icon:Recycle},
    {label:'Failed actions',value:snapshot.activity.filter(item=>item.result==='Failure').length,icon:AlertTriangle},
  ];
  return <div className="page admin-overview"><PageHeader title={nl?'Administratie':'Administration'} description={nl?'Beveiligde systeemcontrole voor de KCS IT-afdeling.':'Secure system controls for the KCS IT Department.'}/><section className="admin-metrics" aria-label="Administration summary">{metrics.map(({icon:Icon,...metric})=><article className="card" key={metric.label}><Icon/><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</section><header className="section-heading"><div><h2>Administration modules</h2><p>Manage system-wide access, governance, and configuration.</p></div></header><section className="admin-console-grid">{modules.map(({icon:Icon,...card})=><Link className="card admin-console-card" key={card.to} to={card.to}><Icon/><div><h2>{card.title}</h2><p>{card.description}</p><span>Open module →</span></div></Link>)}</section></div>;
}
