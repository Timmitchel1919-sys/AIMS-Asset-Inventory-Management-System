import {describe,expect,it} from 'vitest';
import {MockInventoryRepository} from '../data/mockRepository';
import {buildGlobalSearchIndex,filterGlobalSearchResults} from './useGlobalSearch';

describe('global search empty state',()=>{
  it('returns one stable empty result for an unknown item',()=>{
    const index=buildGlobalSearchIndex(new MockInventoryRepository().snapshot(),'administrator');
    const first=filterGlobalSearchResults(index,'item-that-does-not-exist');
    const second=filterGlobalSearchResults(index,'item-that-does-not-exist');
    expect(first).toEqual([]);
    expect(second).toEqual(first);
  });
});
