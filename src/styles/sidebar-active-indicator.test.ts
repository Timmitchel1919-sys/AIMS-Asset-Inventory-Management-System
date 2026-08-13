import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const shell=readFileSync(new URL('./shell.css',import.meta.url),'utf8');
const tokens=readFileSync(new URL('./tokens.css',import.meta.url),'utf8');

describe('active sidebar indicator',()=>{
  it('uses a separate inward notch on the sidebar edge',()=>{
    expect(shell).toContain('.app-sidebar__active-notch');
    expect(shell).toContain('right:0');
    expect(shell).toContain('border-right:8px solid var(--color-sidebar-active-pointer,#fff)');
    expect(shell).not.toContain('.navigation-item:is(.active,[aria-current="page"])::after');
  });
  it('uses a solid white notch without an edge stripe',()=>{
    expect(tokens.match(/--color-sidebar-active-pointer:\s*#FFFFFF/g)).toHaveLength(3);
    expect(shell).not.toContain('filter:drop-shadow(-1px 0 1px');
  });
});
