const knownPrefixes=['KCSMD','KCSL','KCSBD','KCSRT','KCSPW'] as const;
export function normalizeAssetCode(input:string){
 const compact=input.toUpperCase().replace(/[\s-]+/g,'');
 const prefix=knownPrefixes.find(p=>compact.startsWith(p));
 if(!prefix)return null;
 const raw=compact.slice(prefix.length);
 if(!/^\d+$/.test(raw))return null;
 const codeNumber=Number(raw);
 if(codeNumber<1||codeNumber>5000)return null;
 return{codePrefix:prefix,codeNumber,fullAssetCode:`${prefix}-${codeNumber<100?String(codeNumber).padStart(2,'0'):codeNumber}`};
}
export interface AssetCodeLike{code?:string;codePrefix?:string;codeNumber?:number}
export type AssetCodeSortMode='full'|'prefix'|'sequence';
export function parseAssetCode(value:AssetCodeLike){
 const normalized=value.code?normalizeAssetCode(value.code):null;
 if(normalized)return normalized;
 if(value.codePrefix&&Number.isFinite(value.codeNumber))return{codePrefix:value.codePrefix.toUpperCase(),codeNumber:Number(value.codeNumber),fullAssetCode:`${value.codePrefix.toUpperCase()}-${value.codeNumber}`};
 return null;
}
export function compareAssetCodes(left:AssetCodeLike,right:AssetCodeLike,mode:AssetCodeSortMode='full'){
 const a=parseAssetCode(left),b=parseAssetCode(right);
 if(!a&&!b)return 0;
 if(!a)return 1;
 if(!b)return-1;
 if(mode==='prefix')return a.codePrefix.localeCompare(b.codePrefix)||a.codeNumber-b.codeNumber;
 if(mode==='sequence')return a.codeNumber-b.codeNumber||a.codePrefix.localeCompare(b.codePrefix);
 return a.codePrefix.localeCompare(b.codePrefix)||a.codeNumber-b.codeNumber;
}
