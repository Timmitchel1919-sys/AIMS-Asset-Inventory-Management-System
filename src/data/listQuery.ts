export type SortDirection='asc'|'desc';
export type FilterOperator='eq'|'contains'|'startsWith'|'in'|'gte'|'lte'|'missing'|'truthy';
export interface ListFilter{field:string;operator:FilterOperator;value?:string|number|boolean|string[]}
export interface ListSort{field:string;direction:SortDirection}
export interface ListQuery{search?:string;filters?:ListFilter[];sort?:ListSort[];pageSize:number;cursor?:string}
export interface ListResult<T>{items:T[];totalCount:number;nextCursor?:string;previousCursor?:string;hasNext:boolean;hasPrevious:boolean}
export interface ListQueryAdapter<T>{
  searchable:(keyof T|string)[];
  value:(row:T,field:string)=>unknown;
  compare?:(a:T,b:T,sort:ListSort)=>number|undefined;
}

export class ListQueryError extends Error{
  constructor(public readonly code:'INVALID_CURSOR',message='The list cursor is invalid.'){super(message)}
}

const normalize=(value:unknown)=>String(value??'').trim().toLocaleLowerCase();
const signature=(query:ListQuery)=>{
  const value=JSON.stringify({search:query.search||'',filters:query.filters||[],sort:query.sort||[],pageSize:query.pageSize});
  let hash=2166136261;
  for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619);
  return(hash>>>0).toString(36);
};
const cursorFor=(offset:number,query:ListQuery)=>`kcs1.${offset}.${signature(query)}`;
const offsetFrom=(cursor:string|undefined,query:ListQuery)=>{
  if(!cursor)return 0;
  const match=/^kcs1\.(\d+)\.([a-z0-9]+)$/.exec(cursor);
  if(!match||match[2]!==signature(query))throw new ListQueryError('INVALID_CURSOR');
  return Number(match[1]);
};
const filterMatches=(value:unknown,filter:ListFilter)=>{
  const expected=filter.value;
  switch(filter.operator){
    case'eq':return normalize(value)===normalize(expected);
    case'contains':return normalize(value).includes(normalize(expected));
    case'startsWith':return normalize(value).startsWith(normalize(expected));
    case'in':return Array.isArray(expected)&&expected.map(normalize).includes(normalize(value));
    case'gte':return String(value??'')>=String(expected??'');
    case'lte':return String(value??'')<=String(expected??'');
    case'missing':return value===undefined||value===null||String(value).trim()==='';
    case'truthy':return Boolean(value)===Boolean(expected??true);
  }
};

export function executeListQuery<T>(rows:readonly T[],query:ListQuery,adapter:ListQueryAdapter<T>):ListResult<T>{
  const pageSize=Math.max(1,Math.min(100,Math.trunc(query.pageSize||25)));
  const search=normalize(query.search);
  const filtered=rows.filter(row=>{
    if(search&&!adapter.searchable.some(field=>normalize(adapter.value(row,String(field))).includes(search)))return false;
    return(query.filters||[]).every(filter=>filterMatches(adapter.value(row,filter.field),filter));
  });
  const indexed=filtered.map((row,index)=>({row,index}));
  if(query.sort?.length)indexed.sort((left,right)=>{
    for(const sort of query.sort||[]){
      const custom=adapter.compare?.(left.row,right.row,sort);
      const a=adapter.value(left.row,sort.field),b=adapter.value(right.row,sort.field);
      const compared=custom??(typeof a==='number'&&typeof b==='number'?a-b:String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'}));
      if(compared)return sort.direction==='desc'?-compared:compared;
    }
    return left.index-right.index;
  });
  const normalizedQuery={...query,pageSize};
  const requestedOffset=offsetFrom(query.cursor,normalizedQuery);
  if(requestedOffset>indexed.length)throw new ListQueryError('INVALID_CURSOR');
  const items=indexed.slice(requestedOffset,requestedOffset+pageSize).map(value=>value.row);
  const nextOffset=requestedOffset+items.length;
  return{
    items,totalCount:indexed.length,
    nextCursor:nextOffset<indexed.length?cursorFor(nextOffset,normalizedQuery):undefined,
    previousCursor:requestedOffset>0?cursorFor(Math.max(0,requestedOffset-pageSize),normalizedQuery):undefined,
    hasNext:nextOffset<indexed.length,hasPrevious:requestedOffset>0
  };
}
