import type {ListFilter,ListSort} from './listQuery';

export const LIST_PREFERENCES_VERSION=1;
export interface SavedListView{
  id:string;name:string;search:string;filters:ListFilter[];sort:ListSort[];pageSize:number;visibleColumns:string[];ownerId:string;isShared:boolean;version:number;
}
export interface ListPreferences{version:number;visibleColumns:string[];savedViews:SavedListView[]}
export interface ListPermissions{canEdit:boolean;canArchive:boolean;canRequestDisposal:boolean;canExport:boolean}

export const defaultListPreferences=(columns:string[]):ListPreferences=>({version:LIST_PREFERENCES_VERSION,visibleColumns:columns,savedViews:[]});
export function loadListPreferences(storage:Pick<Storage,'getItem'>,key:string,columns:string[]):ListPreferences{
  try{
    const parsed=JSON.parse(storage.getItem(key)||'null') as ListPreferences|null;
    if(!parsed||parsed.version!==LIST_PREFERENCES_VERSION)return defaultListPreferences(columns);
    return{...parsed,visibleColumns:parsed.visibleColumns.filter(column=>columns.includes(column)),savedViews:parsed.savedViews.filter(view=>view.version===LIST_PREFERENCES_VERSION)};
  }catch{return defaultListPreferences(columns)}
}
export function saveListPreferences(storage:Pick<Storage,'setItem'>,key:string,value:ListPreferences){try{storage.setItem(key,JSON.stringify(value))}catch{return false}return true}
export function upsertSavedView(preferences:ListPreferences,view:SavedListView){
  const savedViews=[...preferences.savedViews.filter(item=>item.id!==view.id),view];
  return{...preferences,savedViews};
}
export function removeSavedView(preferences:ListPreferences,id:string){return{...preferences,savedViews:preferences.savedViews.filter(view=>view.id!==id)}}
export function availableBulkActions(permissions:ListPermissions){
  return[
    permissions.canEdit&&'edit',
    permissions.canEdit&&'location',
    permissions.canEdit&&'department',
    permissions.canEdit&&'status',
    permissions.canArchive&&'archive',
    permissions.canRequestDisposal&&'disposal',
    permissions.canExport&&'qr',
    permissions.canExport&&'export'
  ].filter(Boolean) as string[];
}
