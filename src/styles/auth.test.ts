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
});
