import type {ThemeId} from '../domain/types';
import {normalizeTheme} from '../domain/rules';

export const AIMS_THEME_IDS=['aimsAzureGlass','aimsEmeraldGlass'] as const;
export const PUBLIC_AIMS_THEME:ThemeId='aimsAzureGlass';
export const DEFAULT_AIMS_THEME:ThemeId='aimsAzureGlass';
export const AUTHENTICATED_THEME_STORAGE_KEY='authenticatedThemePreference';
export const LEGACY_THEME_STORAGE_KEY='kcs-theme';
export const DEFAULT_KCS_THEME=DEFAULT_AIMS_THEME;
export type KcsThemeId=ThemeId;

const cssTheme:Record<ThemeId,string>={aimsAzureGlass:'kcs-azure-intelligence',aimsEmeraldGlass:'kcs-forest-gold'};
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
export function applyPwaThemeBranding(theme:ThemeId=PUBLIC_AIMS_THEME):void{
 const logo=theme==='aimsEmeraldGlass'?'/aims-logo-green.png':'/aims-logo-blue.png';
 const themeColor=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');if(themeColor)themeColor.content='#155EEF';
 const favicon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(favicon)favicon.href=logo;
 const appleIcon=document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');if(appleIcon)appleIcon.href=logo;
 const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(manifest)manifest.href='/manifest-azure.webmanifest';
}
export function applyKcsTheme(theme:ThemeId,persist=true):void{
 const selected=isValidKcsTheme(theme)?theme:DEFAULT_AIMS_THEME;
 document.documentElement.dataset.aimsTheme=selected;document.documentElement.dataset.theme=cssTheme[selected];applyPwaThemeBranding(selected);
 if(persist)persistAuthenticatedTheme(selected);
 window.dispatchEvent(new CustomEvent('kcs-theme-change',{detail:{themeId:selected}}));
}
export function initializeKcsTheme():ThemeId{applyKcsTheme(PUBLIC_AIMS_THEME,false);return getStoredKcsTheme()}
