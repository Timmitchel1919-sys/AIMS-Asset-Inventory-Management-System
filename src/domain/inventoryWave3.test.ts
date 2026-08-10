import {describe,expect,it} from 'vitest';
import {availableStock,fulfillReservation,isLowStock,releaseStock,reorderRecommendation,reserveStock,stockStatus,validateLocationMove} from './rules';

const item={onHand:8,reserved:2,minimum:10,reorderLevel:12,reorderQuantity:10,maximum:30,archived:false};
describe('Wave 3 inventory rules',()=>{
  it('calculates available stock from on hand minus reserved',()=>expect(availableStock(item)).toBe(6));
  it('derives low and out of stock states',()=>{expect(stockStatus(item)).toBe('Low stock');expect(stockStatus({...item,onHand:0,reserved:0})).toBe('Out of stock')});
  it('prevents reservations above available stock',()=>expect(()=>reserveStock(item,7)).toThrow(/available/i));
  it('releases and fulfills reservations consistently',()=>{expect(releaseStock(4,2)).toBe(2);expect(fulfillReservation(8,4,3)).toEqual({onHand:5,reserved:1})});
  it('detects low stock and suggests reorder quantity',()=>{expect(isLowStock(item)).toBe(true);expect(reorderRecommendation(item)).toBe(22)});
  it('prevents circular location hierarchy',()=>expect(validateLocationMove('a','c',[{id:'a'},{id:'b',parent:'a'},{id:'c',parent:'b'}])).toBe(false));
});
