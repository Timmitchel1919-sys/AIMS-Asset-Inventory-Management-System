// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {applyKcsTheme,AUTHENTICATED_THEME_STORAGE_KEY,DEFAULT_KCS_THEME,getStoredKcsTheme,isValidKcsTheme} from './kcs-theme';

describe('authenticated AIMS theme persistence',()=>{
  beforeEach(()=>localStorage.clear());
  it('uses AIMS Midnight as the configured fallback',()=>{expect(isValidKcsTheme('aimsMidnight')).toBe(true);expect(DEFAULT_KCS_THEME).toBe('aimsMidnight');expect(getStoredKcsTheme()).toBe('aimsMidnight')});
  it('rejects the removed AIMS Emerald Glass theme',()=>expect(isValidKcsTheme('aimsEmeraldGlass')).toBe(false));
  it('persists and restores Emerald Gloss',()=>{applyKcsTheme('aimsEmeraldGloss');expect(localStorage.getItem(AUTHENTICATED_THEME_STORAGE_KEY)).toBe('aimsEmeraldGloss');expect(document.documentElement.dataset.aimsTheme).toBe('aimsEmeraldGloss');expect(document.documentElement.dataset.theme).toBe('emerald-gloss');expect(getStoredKcsTheme()).toBe('aimsEmeraldGloss')});
  it('persists AIMS Midnight through the existing preference',()=>{applyKcsTheme('aimsMidnight');expect(localStorage.getItem(AUTHENTICATED_THEME_STORAGE_KEY)).toBe('aimsMidnight');expect(document.documentElement.dataset.theme).toBe('aims-midnight');expect(getStoredKcsTheme()).toBe('aimsMidnight')});
  it('supports the Light theme without a second storage mechanism',()=>{applyKcsTheme('aimsLight');expect(localStorage.getItem(AUTHENTICATED_THEME_STORAGE_KEY)).toBe('aimsLight');expect(document.documentElement.dataset.theme).toBe('aims-light')});
  it('rejects invalid stored themes',()=>{localStorage.setItem(AUTHENTICATED_THEME_STORAGE_KEY,'unknown');expect(getStoredKcsTheme()).toBe('aimsMidnight')});
  it('rejects removed themes',()=>{expect(isValidKcsTheme('kcsEvergreen')).toBe(false);expect(isValidKcsTheme('kcsAzureGlass')).toBe(false)});
  it('rejects the removed KCS Azure Flow theme',()=>expect(isValidKcsTheme('kcsAzureFlow')).toBe(false));
});
