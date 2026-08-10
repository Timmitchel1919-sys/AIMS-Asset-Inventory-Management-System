import {describe,expect,it} from 'vitest';
import {executeListQuery,ListQueryError} from './listQuery';

const rows=[
  {id:'1',code:'KCSMD-2',name:'Zulu',status:'Available'},
  {id:'2',code:'KCSMD-10',name:'Alpha',status:'Archived'},
  {id:'3',code:'KCSMD-3',name:'Beta',status:'Available'}
];
const adapter={searchable:['code','name'],value:(row:typeof rows[number],field:string)=>row[field as keyof typeof row]};
describe('executeListQuery',()=>{
  it('searches, filters, sorts and paginates with opaque cursors',()=>{
    const query={search:'kcs',filters:[{field:'status',operator:'eq' as const,value:'Available'}],sort:[{field:'code',direction:'asc' as const}],pageSize:1};
    const first=executeListQuery(rows,query,adapter);
    expect(first.items).toEqual([rows[0]]);
    expect(first.totalCount).toBe(2);
    const second=executeListQuery(rows,{...query,cursor:first.nextCursor},adapter);
    expect(second.items).toEqual([rows[2]]);
    expect(second.hasPrevious).toBe(true);
  });
  it('rejects a cursor reused with a changed query',()=>{
    const first=executeListQuery(rows,{pageSize:1},adapter);
    expect(()=>executeListQuery(rows,{pageSize:2,cursor:first.nextCursor},adapter)).toThrow(ListQueryError);
  });
  it('preserves source order when sort values tie',()=>{
    const result=executeListQuery(rows,{sort:[{field:'status',direction:'asc'}],pageSize:10},adapter);
    expect(result.items.filter(row=>row.status==='Available').map(row=>row.id)).toEqual(['1','3']);
  });
});
