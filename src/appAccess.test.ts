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

  it('keeps temporary demo Firestore access authenticated and never public',()=>{
    const rules=readFileSync('firestore.rules','utf8');
    expect(rules).toContain('allow read, write: if request.auth != null');
    expect(rules).not.toContain('allow read, write: if true');
    const productionRules=readFileSync('firestore.production.rules','utf8');
    expect(productionRules).toContain("match /users/{id}");
    expect(productionRules).toContain("match /{document=**} { allow read, write: if false; }");
  });

  it('uses Firebase anonymous authentication for one-click demo access',()=>{
    const authSource=readFileSync('src/auth/firebaseAuth.ts','utf8');
    const loginSource=readFileSync('src/pages/Auth.tsx','utf8');
    expect(authSource).toContain('signInAnonymously');
    expect(authSource).toContain('doc(db, "users", user.uid)');
    expect(authSource).toContain('authProvider: "anonymous"');
    expect(loginSource).toContain('required={mode !== "login" || !DEMO_AUTH_MODE}');
    expect(loginSource).not.toContain('Demo mode: click Sign in to enter AIMS.');
  });
});
