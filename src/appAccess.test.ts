import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {can, rolePermissions} from './auth/permissions';
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

  it('routes asset imports directly to the protected combined workbook importer',()=>{
    const route=routeManifest.find(candidate=>candidate.path==='/assets/import');
    expect(route).toMatchObject({id:'asset-import',permission:'assets.import'});
    expect(route?.public).not.toBe(true);
    expect(route?.component).toBeDefined();
  });

  it('shows the combined import action only with assets.import permission',()=>{
    const assetsSource=readFileSync('src/pages/Assets.tsx','utf8');
    expect(assetsSource).toMatch(/can\(user\?\.role,\s*["']assets\.import["']\)/);
    expect(assetsSource).toMatch(/navigate\(["']\/assets\/import["']\)/);
    expect(assetsSource).toMatch(/t\(["']assets\.import["']\)/);
  });

  it('deploys verified school-domain rules with default deny',()=>{
    const rules=readFileSync('firestore.rules','utf8');
    expect(rules).toContain('request.auth.token.email_verified == true');
    expect(rules).toContain("match /users/{uid}");
    expect(rules).toContain("match /{document=**} { allow read, write: if false; }");
  });

  it('keeps the provisioned default grant in sync with the fallback role', () => {
    const source = readFileSync('functions/accessDefaults.js', 'utf8');
    const match = source.match(
      /DEFAULT_ACCESS_PERMISSIONS = \[([\s\S]*?)\];/,
    );
    expect(match).toBeTruthy();
    const provisioned = match![1]
      .match(/"[^"]+"/g)
      ?.map((value) => value.slice(1, -1)) ?? [];
    expect([...provisioned].sort()).toEqual(
      [...rolePermissions['warehouse-staff']].sort(),
    );
  });

  it('grants every fallback-role user add/delete across module data', () => {
    const staff = rolePermissions['warehouse-staff'];
    expect(staff).toContain('assets.create');
    expect(staff).toContain('assets.archive');
    expect(staff).toContain('inventory.create');
    expect(staff).toContain('inventory.edit');
    expect(staff).toContain('borrows.create');
    expect(staff).toContain('maintenance.create');
    expect(staff).toContain('repairs.create');
    expect(staff).not.toContain('admin.access');
    expect(staff).not.toContain('users.manage');
    expect(staff).not.toContain('roles.manage');
    expect(staff).not.toContain('settings.manage');
    expect(staff.length).toBeLessThanOrEqual(200);
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
