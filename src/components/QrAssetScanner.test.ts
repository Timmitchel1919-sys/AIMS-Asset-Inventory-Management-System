import {describe,expect,it} from 'vitest';
import {resolveScannedAsset} from '../domain/qrAssetResolver';
import type {Asset} from '../domain/types';

const asset={id:'ast-001',code:'KCSMD-147',barcode:'BC-147'} as Asset;

describe('QR asset scanner resolution',()=>{
  it.each(['ast-001','KCSMD-147','kcsmd-147','BC-147','https://inventory.kcs.local/assets/ast-001','/assets/ast-001'])(`resolves %s`,value=>{
    expect(resolveScannedAsset(value,[asset])).toBe(asset);
  });
  it('rejects unknown and unrelated QR payloads',()=>{
    expect(resolveScannedAsset('https://example.com/not-an-asset',[asset])).toBeUndefined();
    expect(resolveScannedAsset('KCSMD-999',[asset])).toBeUndefined();
  });
});
