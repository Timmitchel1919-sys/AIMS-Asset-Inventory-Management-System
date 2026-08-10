import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const css=readFileSync(new URL('./tokens.css',import.meta.url),'utf8');
describe('permanent extended asset status tokens',()=>it('defines them only in the base root layer',()=>{
  const themeStart=css.indexOf(':root,[data-theme'),base=css.slice(0,themeStart),themes=css.slice(themeStart);
  for(const status of ['assigned','archived','under-repair']){expect(base).toContain(`--asset-status-${status}-bg`);expect(themes).not.toContain(`--asset-status-${status}-`)}
}));
