import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const rules=readFileSync(new URL('./firestore.rules',import.meta.url),'utf8');
const productionRules=readFileSync(new URL('./firestore.production.rules',import.meta.url),'utf8');
describe('Firestore AIMS authorization rules',()=>{
  it('keeps temporary demo data private to authenticated Firebase users',()=>{
    expect(rules).toContain('allow read, write: if request.auth != null');
    expect(rules).not.toContain('allow read, write: if true');
  });
  it('preserves exact verified school-domain production rules',()=>{
    expect(productionRules).toContain("request.auth.token.email.matches('^[^@]+@[Kk][Aa][Nn][Gg][Oo][Ee][Rr][Oo][Ee][Ss][Cc][Hh][Oo][Oo][Ll][.]com$')");
    expect(productionRules).toContain('hasKangoeroeDomain() && request.auth.token.email_verified == true');
  });
  it('restricts user creation to the authenticated uid and protected metadata',()=>{
    expect(productionRules).toContain('verified() && request.auth.uid == id');
    expect(productionRules).toContain("request.resource.data.accountType == 'school-user'");
    expect(productionRules).toContain("request.resource.data.organizationDomain == 'kangoeroeschool.com'");
    expect(productionRules).toContain("affectedKeys().hasOnly(['displayName','photoURL','department','jobTitle','preferences','authProvider','emailVerified','updatedAt','lastLoginAt'])");
  });
});
