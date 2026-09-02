import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const shell=readFileSync(new URL('./shell.css',import.meta.url),'utf8');
const tokens=readFileSync(new URL('./tokens.css',import.meta.url),'utf8');

describe('active sidebar indicator',()=>{
  it('uses a seamless solid inward notch overlapping the sidebar edge',()=>{
    expect(shell).toContain('.app-sidebar__active-notch');
    expect(shell).toContain('right:-1px');
    expect(shell).toContain('border:0');
    expect(shell).toContain('background:var(--color-sidebar-active-pointer,#fff)');
    expect(shell).toContain('box-shadow:none');
    expect(shell).toContain('border-right:0;box-shadow:none');
    expect(shell).toContain('clip-path:polygon(100% 0,100% 100%,0 50%)');
    expect(shell).not.toContain('border-right:8px solid var(--color-sidebar-active-pointer,#fff)');
    expect(shell).not.toContain('.navigation-item:is(.active,[aria-current="page"])::after');
  });
  it('escapes the sidebar overflow clip on desktop so the notch joins the module panel',()=>{
    expect(shell).toContain('.app-sidebar__active-notch{position:fixed;left:var(--sidebar-expanded-width,248px)');
    expect(shell).toContain('.collapsed .app-sidebar__active-notch{left:var(--sidebar-collapsed-width,76px)}');
  });
  it('uses a solid notch matching each theme\'s own canvas, without an edge stripe',()=>{
    expect(tokens.match(/--color-sidebar-active-pointer:\s*#FFFFFF/g)).toHaveLength(2);
    expect(tokens).toContain('--color-sidebar-active-pointer: #FDFCF9');
    expect(shell).not.toContain('filter:drop-shadow(-1px 0 1px');
  });
});
