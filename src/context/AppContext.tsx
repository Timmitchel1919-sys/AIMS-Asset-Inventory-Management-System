import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {Role,ThemeId,User} from '../domain/types';
import {normalizeTheme} from '../domain/rules';
import {applyKcsTheme,getStoredKcsTheme,persistAuthenticatedTheme,PUBLIC_AIMS_THEME} from '../lib/kcs-theme';
const users:Record<Role,User>={
 administrator:{id:'u1',name:'Naomi Williams',email:'admin@kcs.example',role:'administrator',department:'ICT',initials:'NW'},
 'ict-manager':{id:'u2',name:'Michael King',email:'ict-manager@kcs.example',role:'ict-manager',department:'ICT',initials:'MK'},
 'warehouse-manager':{id:'u3',name:'Rita James',email:'inventory@kcs.example',role:'warehouse-manager',department:'Warehouse',initials:'RJ'},
 'ict-staff':{id:'u4',name:'Joseph Lewis',email:'technician@kcs.example',role:'ict-staff',department:'ICT',initials:'JL'},
 'warehouse-staff':{id:'u5',name:'Claire Wilson',email:'readonly@kcs.example',role:'warehouse-staff',department:'Warehouse',initials:'CW'},
 management:{id:'u6',name:'Daniel Moore',email:'manager@kcs.example',role:'management',department:'Management',initials:'DM'},
 auditor:{id:'u7',name:'Alex Auditor',email:'auditor@kcs.example',role:'auditor',department:'Audit',initials:'AA'}
};
type Ctx={user:User|null;login:(role?:Role,remember?:boolean)=>void;logout:()=>void;theme:ThemeId;effectiveTheme:ThemeId;setTheme:(t:ThemeId)=>void;setThemeRoute:(pathname:string)=>void;language:'en'|'nl';setLanguage:(l:'en'|'nl')=>void;sidebarCollapsed:boolean;setSidebarCollapsed:(v:boolean)=>void;mobileOpen:boolean;setMobileOpen:(v:boolean)=>void};
const AppContext=createContext<Ctx|null>(null);
const isPublicThemePath=(pathname:string)=>/^\/(?:$|login\/?$|register\/?$|forgot-password\/?$|reset-password\/?$|terms\/?$|privacy\/?$|support\/?$|download\/?$)/.test(pathname);
export function AppProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(()=>{
  if(localStorage.getItem('kcs-auth')==='out'&&sessionStorage.getItem('kcs-auth')!=='in')return null;
  const storedRole=(localStorage.getItem('kcs-role')||sessionStorage.getItem('kcs-role')) as Role|null;
  return storedRole&&users[storedRole]?users[storedRole]:users.administrator;
 });
 const [theme,setThemeState]=useState<ThemeId>(()=>getStoredKcsTheme());
 const [publicPath,setPublicPath]=useState(()=>isPublicThemePath(typeof window==='undefined'?'/':window.location.pathname));
 const [language,setLanguageState]=useState<'en'|'nl'>(()=>(localStorage.getItem('kcs-language') as 'en'|'nl')||'en');
 const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>{try{return typeof window!=='undefined'&&window.localStorage.getItem('kcs-sidebar-collapsed')==='true'}catch{return false}});
 const [mobileOpen,setMobileOpen]=useState(false);
 const effectiveTheme=publicPath?PUBLIC_AIMS_THEME:theme;
 useEffect(()=>{applyKcsTheme(effectiveTheme,false)},[effectiveTheme]);
 useEffect(()=>{try{localStorage.setItem('kcs-sidebar-collapsed',String(sidebarCollapsed))}catch{/* Keep the in-memory state when storage is unavailable. */}},[sidebarCollapsed]);
 const value=useMemo(()=>({user,login:(role:Role='administrator',remember=true)=>{setUser(users[role]);localStorage.setItem('kcs-auth',remember?'in':'out');localStorage.removeItem('kcs-role');sessionStorage.removeItem('kcs-auth');sessionStorage.removeItem('kcs-role');const storage=remember?localStorage:sessionStorage;storage.setItem('kcs-auth','in');storage.setItem('kcs-role',role)},logout:()=>{setUser(null);localStorage.setItem('kcs-auth','out');localStorage.removeItem('kcs-role');sessionStorage.removeItem('kcs-auth');sessionStorage.removeItem('kcs-role')},theme,effectiveTheme,setTheme:(next:ThemeId)=>{const normalized=normalizeTheme(next);setThemeState(normalized);persistAuthenticatedTheme(normalized)},setThemeRoute:(pathname:string)=>setPublicPath(isPublicThemePath(pathname)),language,setLanguage:(l:'en'|'nl')=>{setLanguageState(l);localStorage.setItem('kcs-language',l)},sidebarCollapsed,setSidebarCollapsed,mobileOpen,setMobileOpen}),[user,theme,effectiveTheme,language,sidebarCollapsed,mobileOpen]);
 return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
export const useApp=()=>{const c=useContext(AppContext);if(!c)throw new Error('AppProvider missing');return c};
