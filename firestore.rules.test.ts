import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const rules=readFileSync(new URL('./firestore.rules',import.meta.url),'utf8');
describe('Firestore AIMS authorization rules',()=>{
  it('uses one secure exact verified-domain production ruleset',()=>{
    expect(rules).toContain("request.auth.token.email.matches('^[^@]+@[Kk][Aa][Nn][Gg][Oo][Ee][Rr][Oo][Ee][Ss][Cc][Hh][Oo][Oo][Ll][.]com$')");
    expect(rules).toContain('request.auth.token.email_verified == true');
    expect(rules).not.toContain('allow read, write: if request.auth != null');
  });
  it('restricts user creation to the authenticated uid and protected metadata',()=>{
    expect(rules).toContain('isVerified() && request.auth.uid == uid');
    expect(rules).toContain("data.accountType == 'school-user'");
    expect(rules).toContain("data.organizationDomain == 'kangoeroeschool.com'");
    expect(rules).toContain("affectedKeys().hasOnly(['displayName','photoURL','department','jobTitle','preferences','authProvider','emailVerified','updatedAt','lastLoginAt'])");
  });
  it('keeps audit history immutable and defaults to deny',()=>{
    expect(rules).toContain('match /activityLogs/{id}');
    expect(rules).toContain('allow update, delete: if false;');
    expect(rules).toContain('match /{document=**} { allow read, write: if false; }');
  });
});
