import type {ThemeId} from '../domain/types';
import {normalizeTheme} from '../domain/rules';

export const AIMS_THEME_IDS=['aimsAzureGlass','aimsMidnight','aimsEmeraldGloss','aimsLight'] as const;
export const PUBLIC_AIMS_THEME:ThemeId='aimsAzureGlass';
export const DEFAULT_AIMS_THEME:ThemeId='aimsAzureGlass';
export const AUTHENTICATED_THEME_STORAGE_KEY='authenticatedThemePreference';
export const LEGACY_THEME_STORAGE_KEY='kcs-theme';
export const DEFAULT_KCS_THEME=DEFAULT_AIMS_THEME;
export type KcsThemeId=ThemeId;

const cssTheme:Record<ThemeId,string>={aimsAzureGlass:'kcs-azure-intelligence',aimsMidnight:'aims-midnight',aimsEmeraldGloss:'emerald-gloss',aimsLight:'aims-light'};
export const isValidKcsTheme=(value:unknown):value is ThemeId=>typeof value==='string'&&AIMS_THEME_IDS.includes(value as ThemeId);

export function getStoredKcsTheme():ThemeId{
 try{
  const current=localStorage.getItem(AUTHENTICATED_THEME_STORAGE_KEY);
  if(isValidKcsTheme(current))return current;
  return normalizeTheme(localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
 }catch{return DEFAULT_AIMS_THEME}
}
export function persistAuthenticatedTheme(theme:ThemeId):void{
 const selected=isValidKcsTheme(theme)?theme:DEFAULT_AIMS_THEME;
 try{localStorage.setItem(AUTHENTICATED_THEME_STORAGE_KEY,selected);localStorage.setItem(LEGACY_THEME_STORAGE_KEY,selected)}catch{/* Keep in-memory preference. */}
}
const manifestByTheme:Record<ThemeId,string>={aimsAzureGlass:'/manifest-azure.webmanifest',aimsMidnight:'/manifest-midnight.webmanifest',aimsEmeraldGloss:'/manifest-emerald-gloss.webmanifest',aimsLight:'/manifest-light.webmanifest'};
const pwaColorByTheme:Record<ThemeId,string>={aimsAzureGlass:'#061D52',aimsMidnight:'#102640',aimsEmeraldGloss:'#063D2E',aimsLight:'#F4F7FB'};
export function applyPwaThemeBranding(theme:ThemeId=PUBLIC_AIMS_THEME):void{
 const selected=isValidKcsTheme(theme)?theme:PUBLIC_AIMS_THEME;
 const themeColor=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');if(themeColor)themeColor.content=pwaColorByTheme[selected];
 const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(manifest)manifest.href=manifestByTheme[selected];
}
export function applyKcsTheme(theme:ThemeId,persist=true):void{
 const selected=isValidKcsTheme(theme)?theme:DEFAULT_AIMS_THEME;
 document.documentElement.dataset.aimsTheme=selected;document.documentElement.dataset.theme=cssTheme[selected];applyPwaThemeBranding(selected);
 if(persist)persistAuthenticatedTheme(selected);
 window.dispatchEvent(new CustomEvent('kcs-theme-change',{detail:{themeId:selected}}));
}
export function initializeKcsTheme():ThemeId{applyKcsTheme(PUBLIC_AIMS_THEME,false);return getStoredKcsTheme()}
