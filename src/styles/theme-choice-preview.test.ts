import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const css=readFileSync(new URL('./components.css',import.meta.url),'utf8');

describe('theme choice previews',()=>{
  it('shows Azure Glass with sidebar blue, blue and white',()=>{
    expect(css).toContain('.theme-aimsAzureGlass i span:first-child');
    expect(css).toContain('background: #061d52');
    expect(css).toContain('.theme-aimsAzureGlass i span:nth-child(2)');
    expect(css).toContain('background: #3b91ed');
    expect(css).toContain('.theme-aimsAzureGlass i span:nth-child(3)');
    expect(css).toContain('background: #ffffff');
  });
});
