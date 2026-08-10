import {Suspense,useEffect} from 'react';
import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {AppShell} from './components/shell';
import {RouteErrorBoundary,RouteLoader} from './components/RouteBoundary';
import {can} from './auth/permissions';
import {routeManifest,type AppRoute} from './routes/manifest';
import {useApp} from './context/AppContext';

function RenderRoute({route}:{route:AppRoute}){
  const {user}=useApp();
  const location=useLocation();
  const Page=route.component;
  if(route.public){
    if(route.id==='login'&&user)return <Navigate to="/dashboard" replace/>;
    return <RouteErrorBoundary><Suspense fallback={<RouteLoader/>}><Page/></Suspense></RouteErrorBoundary>;
  }
  if(!user)return <Navigate to="/login" state={{from:location}} replace/>;
  if(!can(user.role,route.permission))return <Navigate to="/403" replace/>;
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
