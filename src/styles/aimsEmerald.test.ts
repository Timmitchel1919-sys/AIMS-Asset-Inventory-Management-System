import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';
const emerald=readFileSync(new URL('./aims-emerald.css',import.meta.url),'utf8'),status=readFileSync(new URL('./tokens.css',import.meta.url),'utf8');
describe('AIMS Emerald Glass',()=>{
 it('defines the approved centralized palette and route-applied selector',()=>{for(const value of ['#0D2B1E','#146C43','#2ECC71','#D9F3E3','#64748B','#F2F5F7','#FFFFFF'])expect(emerald).toContain(value);expect(emerald).toContain('data-aims-theme="aimsEmeraldGlass"')});
 it('does not redefine permanent asset status tokens',()=>{expect(emerald).not.toContain('--asset-status-');expect(status).toContain('--asset-status-assigned-solid:#7C3AED')});
 it('includes reduced transparency and mobile fallbacks',()=>{expect(emerald).toContain('prefers-reduced-transparency:reduce');expect(emerald).toContain('@media(max-width:780px)')});
});
