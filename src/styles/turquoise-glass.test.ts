import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';
const theme=readFileSync(new URL('./turquoise-glass.css',import.meta.url),'utf8');
const components=readFileSync(new URL('./components.css',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../../public/manifest-turquoise-glass.webmanifest',import.meta.url),'utf8')) as {theme_color:string;background_color:string;icons:{sizes:string;purpose?:string}[]};

describe('AIMS Premium Turquoise Glass',()=>{
 it('defines the approved turquoise palette',()=>{
  for(const value of ['#071317','#0D1D22','#25C7B7','#087B74','#79E6DD','#4a9bf0'])expect(theme).toContain(value);
 });
 it('scopes every rule to the turquoise theme attribute',()=>{
  expect(theme).toContain('data-aims-theme="aimsTurquoiseGlass"');
  const selectors=theme.match(/html\[[^\]]*\]/g)??[];
  expect(selectors.length).toBeGreaterThan(0);
  for(const selector of selectors)expect(selector).toContain('data-aims-theme="aimsTurquoiseGlass"');
 });
 it('maps the semantic surface, text, focus and sidebar tokens',()=>{
  for(const token of ['--color-background','--color-surface','--color-surface-elevated','--color-text-primary','--color-border','--color-focus-ring','--color-primary','--color-sidebar-background','--color-sidebar-active','--color-input-background','--color-table-header','--color-overlay'])expect(theme).toContain(token+':');
  expect(theme).toContain('color-scheme: dark');
 });
 it('keeps text and control pairs at WCAG AA contrast',()=>{
  const luminance=(hex:string)=>{const channels=hex.replace('#','').match(/../g)!.map(part=>parseInt(part,16)/255).map(value=>value<=0.03928?value/12.92:((value+0.055)/1.055)**2.4);return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2]};
  const contrast=(a:string,b:string)=>{const [l1,l2]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (l1+0.05)/(l2+0.05)};
  expect(contrast('#F4FAFA','#071317')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#c9e6e4','#0D1D22')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#9fc7c4','#0D1D22')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#041011','#25C7B7')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#ffffff','#1f6fcc')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#4a9bf0','#0D1D22')).toBeGreaterThanOrEqual(4.5);
 });
 it('renders the theme-picker swatch with sidebar, primary, and accent columns',()=>{
  expect(components).toContain('.theme-aimsTurquoiseGlass i span:first-child { background: #071317; }');
  expect(components).toContain('.theme-aimsTurquoiseGlass i span:nth-child(2) { background: #25C7B7; }');
  expect(components).toContain('.theme-aimsTurquoiseGlass i span:nth-child(3) { background: #79E6DD; }');
 });
 it('ships a matching installable manifest',()=>{
  expect(manifest.theme_color).toBe('#071317');
  expect(manifest.background_color).toBe('#071317');
  expect(manifest.icons.map(icon=>icon.sizes)).toEqual(expect.arrayContaining(['192x192','512x512']));
  expect(manifest.icons.some(icon=>icon.purpose==='maskable')).toBe(true);
 });
 it('includes reduced transparency and reduced motion fallbacks',()=>{
  expect(theme).toContain('prefers-reduced-transparency: reduce');
  expect(theme).toContain('prefers-reduced-motion: reduce');
 });
});
