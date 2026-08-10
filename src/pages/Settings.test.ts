import{describe,expect,it}from'vitest';
import{settingsPath,tabFromPath}from'./Settings';
import{matchRoute}from'../routes/manifest';

describe('administration settings navigation',()=>{
  it('maps every settings section to a stable administration URL',()=>{
    expect(settingsPath('general')).toBe('/admin/settings/general');
    expect(settingsPath('masterData')).toBe('/admin/settings/location-code-groups');
    expect(settingsPath('security')).toBe('/admin/settings/security');
    expect(settingsPath('legal')).toBe('/admin/settings/legal');
  });
  it('restores the selected section from its URL',()=>{
    expect(tabFromPath('/admin/settings/app')).toBe('app');
    expect(tabFromPath('/admin/settings/location-code-groups')).toBe('masterData');
    expect(tabFromPath('/admin/settings/notifications')).toBe('notifications');
    expect(tabFromPath('/admin/settings/integrations')).toBe('integrations');
  });
  it('matches the settings wildcard at its base and child routes',()=>{
    expect(matchRoute('/admin/settings')?.id).toBe('admin-settings');
    expect(matchRoute('/admin/settings/security')?.id).toBe('admin-settings');
  });
});
