import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';
const gloss=readFileSync(new URL('./emerald-gloss.css',import.meta.url),'utf8'),status=readFileSync(new URL('./tokens.css',import.meta.url),'utf8');
describe('Emerald Gloss',()=>{
 it('defines the approved brand palette and route-applied selector',()=>{for(const value of ['#27AE60','#219653','#1B7F46','#5CD48B','#145A32'])expect(gloss).toContain(value);expect(gloss).toContain('data-aims-theme="aimsEmeraldGloss"');expect(gloss).toContain('html[data-theme="emerald-gloss"]')});
 it('does not redefine permanent asset status tokens',()=>{expect(gloss).not.toContain('--asset-status-');expect(status).toContain('--asset-status-assigned-solid:#7C3AED')});
 it('gives glossy treatment only to primary actions, not to inactive tabs',()=>{expect(gloss).toContain('.subnav button.active');expect(gloss).not.toContain('.subnav button,')});
 it('uses green sidebar waves, a full active fill and dark-green overview figures',()=>{expect(gloss).toContain('html[data-theme="emerald-gloss"] .app-sidebar::before');expect(gloss).toContain('background:var(--emerald-gloss-gradient)');expect(gloss).not.toContain('border-left:3px');expect(gloss).toContain('.metrics-card .metric strong{color:var(--emerald-gloss-deep)}')});
 it('keeps sidebar module labels bright white',()=>{expect(gloss).toContain('.navigation-item__label{color:#F8FFFA}');expect(gloss).toContain('.navigation-item__label{color:#FFFFFF}')});
 it('includes reduced transparency fallback',()=>{expect(gloss).toContain('prefers-reduced-transparency:reduce')});
});
