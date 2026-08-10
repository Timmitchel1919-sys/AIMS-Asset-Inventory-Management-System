import {describe,expect,it} from 'vitest';
import {availableBulkActions,defaultListPreferences,LIST_PREFERENCES_VERSION,loadListPreferences,removeSavedView,upsertSavedView} from './listPreferences';

describe('list preferences',()=>{
  it('falls back when stored data is invalid or outdated',()=>{
    expect(loadListPreferences({getItem:()=>'{oops'},'key',['code'])).toEqual(defaultListPreferences(['code']));
    expect(loadListPreferences({getItem:()=>JSON.stringify({version:0})},'key',['code'])).toEqual(defaultListPreferences(['code']));
  });
  it('saves and removes versioned views',()=>{
    const base=defaultListPreferences(['code']);
    const view={id:'mine',name:'Mine',search:'',filters:[],sort:[],pageSize:25,visibleColumns:['code'],ownerId:'u1',isShared:false,version:LIST_PREFERENCES_VERSION};
    expect(removeSavedView(upsertSavedView(base,view),'mine').savedViews).toEqual([]);
  });
  it('only exposes permission-authorized bulk actions',()=>{
    expect(availableBulkActions({canEdit:false,canArchive:true,canRequestDisposal:false,canExport:true})).toEqual(['archive','qr','export']);
  });
});
