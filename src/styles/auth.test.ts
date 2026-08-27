import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const css=readFileSync(new URL('./auth.css',import.meta.url),'utf8');

describe('theme-responsive authentication surface',()=>{
  it('defines the authentication scope and its required semantic palette',()=>{
    expect(css).toContain('.auth-page');
    for(const token of ['--auth-navy-deep','--auth-primary','--auth-card','--auth-text-primary','--auth-input-border','--auth-danger','--auth-pattern'])expect(css).toContain(token);
  });

  it('includes interaction, responsive and reduced-motion states',()=>{
    for(const selector of [':focus-within','.invalid',':disabled','@media (max-width:767px)','@media (prefers-reduced-motion:reduce)'])expect(css).toContain(selector);
  });

  it('keeps signup on the frozen login background with a visible card-local scrollbar',()=>{
    expect(css).toContain('.auth-page.auth-signup');
    expect(css).toContain('position:fixed;inset:0;height:100dvh');
    expect(css).toContain('scrollbar-width:thin');
    expect(css).toContain('.auth-signup .login-card::-webkit-scrollbar{width:8px}');
    expect(css).toContain('.auth-signup .login-card::-webkit-scrollbar-thumb');
    expect(css).toContain('.auth-signup .auth-brand-content{width:min(650px,100%);height:auto;min-height:0;justify-content:center');
  });

  it('uses one authoritative background rule for login and signup',()=>{
    expect(css).toContain('.auth-page:is(.auth-login,.auth-signup)');
    expect(css).toContain('radial-gradient(circle at 52% 48%,#fff 0,#f4fbff 32%,#d5effe 72%,#c7e8fb 100%)!important');
    expect(css).toContain('.auth-page:is(.auth-login,.auth-signup) .auth-panel::after{display:none!important}');
  });
});
