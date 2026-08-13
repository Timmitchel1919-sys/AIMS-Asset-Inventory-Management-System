import{describe,expect,it}from'vitest';
import{settingsPath,tabFromPath}from'./Settings';
import{matchRoute}from'../routes/manifest';

describe('system settings navigation',()=>{
  it('maps every settings section to a stable system settings URL',()=>{
    expect(settingsPath('general')).toBe('/settings/general');
    expect(settingsPath('masterData')).toBe('/settings/location-code-groups');
    expect(settingsPath('security')).toBe('/settings/security');
    expect(settingsPath('legal')).toBe('/settings/legal');
  });
  it('restores the selected section from its URL',()=>{
    expect(tabFromPath('/admin/settings/app')).toBe('app');
    expect(tabFromPath('/admin/settings/location-code-groups')).toBe('masterData');
    expect(tabFromPath('/admin/settings/notifications')).toBe('notifications');
    expect(tabFromPath('/admin/settings/integrations')).toBe('integrations');
  });
  it('matches the settings wildcard at its base and child routes',()=>{
    expect(matchRoute('/settings')?.id).toBe('settings');
    expect(matchRoute('/settings/security')?.id).toBe('settings');
  });
});
