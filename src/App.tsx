import {Suspense,useEffect} from 'react';
import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {AppShell} from './components/shell';
import {RouteErrorBoundary,RouteLoader} from './components/RouteBoundary';
import {can} from './auth/permissions';
import {routeManifest,type AppRoute} from './routes/manifest';
import {useApp} from './context/AppContext';
import {DEMO_AUTH_MODE} from './auth/aimsEmailPolicy';

function RenderRoute({route}:{route:AppRoute}){
  const {user,authLoading,emailVerified,accessDenied}=useApp();
  const location=useLocation();
  const Page=route.component;
  if(authLoading)return <RouteLoader/>;
  if(accessDenied&&route.id!=='access-denied')return <Navigate to="/access-denied" replace/>;
  if(route.public){
    if(['login','signup'].includes(route.id)&&user)return <Navigate to={emailVerified?'/dashboard':'/verify-email'} replace/>;
    if(route.id==='verify-email'&&!user)return <Navigate to="/login" replace/>;
    if(route.id==='verify-email'&&emailVerified)return <Navigate to="/dashboard" replace/>;
    return <RouteErrorBoundary><Suspense fallback={<RouteLoader/>}><Page/></Suspense></RouteErrorBoundary>;
  }
  if(!user)return <Navigate to="/login" state={{from:location}} replace/>;
  if(!emailVerified&&!(DEMO_AUTH_MODE&&user.isDemoUser))return <Navigate to="/verify-email" replace/>;
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
