import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const css=readFileSync(new URL('./dark.css',import.meta.url),'utf8').toLowerCase();

describe('AIMS Dark Bento theme contract',()=>{
  it('scopes every rule to the dark theme only',()=>{
    expect(css).toContain('html[data-theme="dark"] {');
  });
  it('centralizes the approved bento palette',()=>{
    for(const color of ['#020203','#2949c8','#6b86f5','#e5e1e5','#c5c5d6','#8e90a0','#b9c3ff'])expect(css).toContain(color);
  });
  it('uses the grid background with soft navy glows',()=>{
    expect(css).toContain('background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px');
    expect(css).toContain('radial-gradient(circle at 10% 10%, rgba(20,32,85,0.35)');
  });
  it('covers sidebar, topbar, forms, tables, auth and bottom navigation',()=>{
    for(const selector of ['.app-sidebar','.topbar',':is(input, select, textarea','.btn.primary','tbody tr:hover',':is(.auth-page','.bottom-nav a'])expect(css).toContain(selector);
  });
  it('renders the table header bar grey with white text',()=>{
    expect(css).toMatch(/:is\(thead, thead th\) \{\s*background: #3a3a3d !important;\s*color: #ffffff !important;/);
  });
  it('outlines the topbar global search field in white',()=>{
    expect(css).toMatch(/\.global-search__input-wrapper \{\s*border: 1px solid rgba\(255, 255, 255, 0\.85\) !important;/);
  });
});

