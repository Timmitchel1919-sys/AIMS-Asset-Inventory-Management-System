import type {Asset} from './types';

function assetReference(value:string){
  const trimmed=value.trim();
  if(!trimmed)return'';
  try{
    const url=new URL(trimmed,typeof window==='undefined'?'https://inventory.kcs.local':window.location.origin);
    const match=url.pathname.match(/^\/assets\/([^/?#]+)\/?$/i);
    if(match)return decodeURIComponent(match[1]);
  }catch{/* A plain asset ID or KCS code is also valid input. */}
  return trimmed;
}

export function resolveScannedAsset(value:string,assets:Asset[]){
  const reference=assetReference(value).toLowerCase();
  return assets.find(asset=>asset.id.toLowerCase()===reference||asset.code.toLowerCase()===reference||asset.barcode?.toLowerCase()===reference);
}
