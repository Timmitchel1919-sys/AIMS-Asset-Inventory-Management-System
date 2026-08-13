import {describe,expect,it} from 'vitest';
import {isSidebarRouteActive} from './shell';

const routes=[
  {id:'assets',path:'/assets'},
  {id:'admin',path:'/admin'},
  {id:'admin-settings',path:'/admin/settings/*'},
  {id:'reports',path:'/reports'}
];

describe('sidebar active module matching',()=>{
  it('keeps a module active on nested routes',()=>expect(isSidebarRouteActive('/assets/asset-1',routes[0],routes)).toBe(true));
  it('selects the most specific visible module',()=>{expect(isSidebarRouteActive('/admin/settings/appearance',routes[1],routes)).toBe(false);expect(isSidebarRouteActive('/admin/settings/appearance',routes[2],routes)).toBe(true)});
  it('maps legacy and grouped routes to their sidebar modules',()=>{expect(isSidebarRouteActive('/settings/location-codes',routes[2],routes)).toBe(true);expect(isSidebarRouteActive('/management/assets',routes[3],routes)).toBe(true)});
});
