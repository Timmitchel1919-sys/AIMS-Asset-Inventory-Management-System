import {Suspense,useEffect} from 'react';
import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {AppShell} from './components/shell';
import {RouteErrorBoundary,RouteLoader} from './components/RouteBoundary';
import {can} from './auth/permissions';
import {routeManifest,type AppRoute} from './routes/manifest';
import {useApp} from './context/AppContext';
import {DEMO_AUTH_MODE} from './auth/aimsEmailPolicy';

function RenderRoute({route}:{route:AppRoute}){
  const {user,authLoading,emailVerified,accessDenied,sessionExpired}=useApp();
  const location=useLocation();
  const Page=route.component;
  if(authLoading)return <RouteLoader/>;
  if(accessDenied&&route.id!=='access-denied')return <Navigate to="/access-denied" replace/>;
  if(route.public){
    if(route.id==='home'&&user&&emailVerified)return <Navigate to="/dashboard" replace/>;
    if(['login','signup'].includes(route.id)&&user)return <Navigate to={emailVerified?'/dashboard':'/verify-email'} replace/>;
    if(route.id==='verify-email'&&!user)return <Navigate to="/login" replace/>;
    if(route.id==='verify-email'&&emailVerified)return <Navigate to="/dashboard" replace/>;
    return <RouteErrorBoundary><Suspense fallback={<RouteLoader/>}><Page/></Suspense></RouteErrorBoundary>;
  }
  if(!user)return <Navigate to="/login" state={{from:location,reason:sessionExpired?'session-expired':undefined}} replace/>;
  if(!emailVerified&&!(DEMO_AUTH_MODE&&user.isDemoUser))return <Navigate to="/verify-email" replace/>;
  
  if(route.ownerOnly&&user.role!=='owner'){
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="bg-red-50 text-red-600 p-4 rounded-full mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h1 className="text-3xl font-light text-slate-800 mb-4">Access restricted</h1>
          <p className="text-slate-600 max-w-md mx-auto mb-8">
            Device management and remote device controls are available only to the authorized AIMS Owner.
          </p>
          <a href="/dashboard" className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-full hover:bg-slate-800 transition-colors">
            Back to Dashboard
          </a>
        </div>
      </AppShell>
    );
  }

  if(!DEMO_AUTH_MODE&&!can(user.role,route.permission))return <Navigate to="/403" replace/>;
  return <AppShell><RouteErrorBoundary><Suspense fallback={<RouteLoader/>}><Page/></Suspense></RouteErrorBoundary></AppShell>;
}

export default function App(){
  const {pathname}=useLocation();
  const {setThemeRoute}=useApp();
  useEffect(()=>setThemeRoute(pathname),[pathname,setThemeRoute]);
  return <Routes>
    {routeManifest.map(route=><Route key={route.id} path={route.path} element={<RenderRoute route={route}/>}/>)}
  </Routes>;
}
