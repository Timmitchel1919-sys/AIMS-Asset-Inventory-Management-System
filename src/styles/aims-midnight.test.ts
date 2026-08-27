import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const css=readFileSync(new URL('./aims-midnight.css',import.meta.url),'utf8').toLowerCase();

describe('AIMS Midnight theme contract',()=>{
  it('centralizes the approved surface and text palette',()=>{
    for(const color of ['#0b1a2e','#102640','#173454','#1e4168','#254d78','#345a82','#2c7ef4','#155eef','#00aeef','#f4f8fc','#c1cedd','#8fa5bc','#5aa2ff','#27ae60','#f5b942','#e35d6a'])expect(css).toContain(color);
  });
  it('reuses the Default Blue wave geometry',()=>{
    for(const geometry of ['width: 540px','height: 540px','left: -270px','bottom: -210px','transform: rotate(-13deg)','width: 440px','height: 270px','right: -255px','top: 145px','transform: rotate(-19deg)'])expect(css).toContain(geometry);
  });
  it('covers notch, mobile waves, forms, tables, auth and bottom navigation',()=>{
    for(const selector of ['.app-sidebar__active-notch','@media (max-width: 780px)',':is(input,select,textarea','.bottom-nav a',':is(.auth-page','.btn.primary','tbody tr:hover'])expect(css).toContain(selector);
  });
  it('uses a glossy cyan fill and a thin white outline for hovered, focused and active sidebar modules',()=>{
    expect(css).toContain('.navigation-item:is(:hover,:focus-visible,.active,[aria-current="page"])');
    expect(css).toContain('border-width: 1px');
    expect(css).toContain('border-color: #ffffff');
    expect(css).toContain('background: linear-gradient(180deg, #5adfff 0%, #00aeef 48%, #008dcc 100%)');
    expect(css).toContain('inset 0 1px 0 rgba(255,255,255,.58)');
  });
});
