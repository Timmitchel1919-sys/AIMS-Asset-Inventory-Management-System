import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {can} from './auth/permissions';
import {appDownloadConfig} from './config/appDownload.config';
import {routeManifest} from './routes/manifest';

describe('app download and admin access integration',()=>{
  it('registers one public download route',()=>{
    const routes=routeManifest.filter(route=>route.path==='/download');
    expect(routes).toHaveLength(1);
    expect(routes[0].public).toBe(true);
  });

  it('does not expose empty mobile store destinations',()=>{
    expect(appDownloadConfig.androidUrl).not.toBe('');
    expect(appDownloadConfig.iosUrl).not.toBe('');
  });

  it('allows only the administrator role to access the Admin Console',()=>{
    expect(can('administrator','admin.access')).toBe(true);
    expect(can('ict-manager','admin.access')).toBe(false);
    expect(can('warehouse-manager','admin.access')).toBe(false);
    expect(can('warehouse-staff','admin.access')).toBe(false);
  });

  it('protects the admin route with admin.access',()=>{
    const route=routeManifest.find(candidate=>candidate.path==='/admin');
    expect(route?.public).not.toBe(true);
    expect(route?.permission).toBe('admin.access');
  });

  it('denies unmatched Firestore access and protects admin collections',()=>{
    const rules=readFileSync('firestore.rules','utf8');
    expect(rules).toContain("match /users/{id}");
    expect(rules).toContain("permission('admin.users.manage')");
    expect(rules).toContain("match /roles/{id}");
    expect(rules).toContain("match /{document=**} { allow read, write: if false; }");
  });
});
