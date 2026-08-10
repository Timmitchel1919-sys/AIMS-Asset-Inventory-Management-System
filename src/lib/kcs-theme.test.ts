// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {applyKcsTheme,AUTHENTICATED_THEME_STORAGE_KEY,DEFAULT_KCS_THEME,getStoredKcsTheme,isValidKcsTheme} from './kcs-theme';

describe('authenticated AIMS theme persistence',()=>{
  beforeEach(()=>localStorage.clear());
  it('uses AIMS Azure Glass as fallback',()=>{expect(isValidKcsTheme('aimsAzureGlass')).toBe(true);expect(DEFAULT_KCS_THEME).toBe('aimsAzureGlass');expect(getStoredKcsTheme()).toBe('aimsAzureGlass')});
  it('persists and restores AIMS Emerald Glass',()=>{applyKcsTheme('aimsEmeraldGlass');expect(localStorage.getItem(AUTHENTICATED_THEME_STORAGE_KEY)).toBe('aimsEmeraldGlass');expect(document.documentElement.dataset.aimsTheme).toBe('aimsEmeraldGlass');expect(document.documentElement.dataset.theme).toBe('kcs-forest-gold');expect(getStoredKcsTheme()).toBe('aimsEmeraldGlass')});
  it('rejects invalid stored themes',()=>{localStorage.setItem(AUTHENTICATED_THEME_STORAGE_KEY,'unknown');expect(getStoredKcsTheme()).toBe('aimsAzureGlass')});
  it('rejects removed themes',()=>{expect(isValidKcsTheme('kcsEvergreen')).toBe(false);expect(isValidKcsTheme('kcsAzureGlass')).toBe(false)});
  it('rejects the removed KCS Azure Flow theme',()=>expect(isValidKcsTheme('kcsAzureFlow')).toBe(false));
});
