import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const css=readFileSync(new URL('./dark.css',import.meta.url),'utf8').toLowerCase();

describe('AIMS Dark Bento theme contract',()=>{
  it('scopes every rule to the dark theme only',()=>{
    expect(css).toContain('html[data-theme="dark"] {');
  });
  it('centralizes the Carry Horizon palette (#0A0A0A / #378DF2 / #0BACC9 / #FFFFFF)',()=>{
    for(const color of ['#0a0a0a','#378df2','#0bacc9','#ffffff'])expect(css).toContain(color);
  });
  it('uses the grid background with blue + cyan radial glows',()=>{
    expect(css).toContain('background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px');
    expect(css).toContain('rgba(55, 141, 242');
    expect(css).toContain('rgba(11, 172, 201');
  });
  it('covers sidebar, topbar, forms, tables, auth and bottom navigation',()=>{
    for(const selector of ['.app-sidebar','.topbar',':is(input, select, textarea','.btn.primary','tbody tr:hover',':is(.auth-page','.bottom-nav a'])expect(css).toContain(selector);
  });
  it('renders the table header bar on the near-black surface with white text',()=>{
    expect(css).toMatch(/:is\(thead, thead th\) \{\s*background: #141414 !important;\s*color: #ffffff !important;/);
  });
  it('outlines the topbar global search field in white',()=>{
    expect(css).toMatch(/\.global-search__input-wrapper \{\s*border: 1px solid rgba\(255, 255, 255, 0\.85\) !important;/);
  });
});
