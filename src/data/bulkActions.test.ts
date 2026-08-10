import {describe,expect,it,vi} from 'vitest';
import {runBulkCommands} from './bulkActions';
describe('runBulkCommands',()=>{
  it('reports per-record partial failures without stopping later records',async()=>{
    const execute=vi.fn().mockResolvedValueOnce({ok:true,message:'ok'}).mockResolvedValueOnce({ok:false,message:'denied'}).mockResolvedValueOnce({ok:true,message:'ok'});
    const result=await runBulkCommands({execute},[{action:'asset.archive',entityId:'1'},{action:'asset.archive',entityId:'2'},{action:'asset.archive',entityId:'3'}]);
    expect(result).toMatchObject({total:3,succeeded:2,failed:1});
    expect(execute).toHaveBeenCalledTimes(3);
  });
});
