const knownPrefixes=['KCSMD','KCSL','KCSBD','KCSRT','KCSPW'] as const;
export function normalizeAssetCode(input:string){
 const normalized=input.toUpperCase().replace(/\s+/g,'');
 const separated=normalized.match(/^([A-Z][A-Z0-9]{1,15})-(\d{1,9})$/);
 const compact=normalized.replace(/-/g,'');
 const prefix=separated?.[1]||knownPrefixes.find(value=>compact.startsWith(value));
 const raw=separated?.[2]||(prefix?compact.slice(prefix.length):'');
 if(!prefix||!/^\d+$/.test(raw))return null;
 const codeNumber=Number(raw);
 if(codeNumber<1||codeNumber>1000000000)return null;
 return{codePrefix:prefix,codeNumber,fullAssetCode:`${prefix}-${codeNumber<100?String(codeNumber).padStart(2,'0'):codeNumber}`};
}export interface AssetCodeLike{code?:string;codePrefix?:string;codeNumber?:number}
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

/**
 * Permanent inventory-code allocation for one code group/prefix.
 *
 * Code groups are unlimited — there is no configurable minimum/maximum
 * range. `group.minimumNumber`/`group.maximumNumber` only exist on the type
 * for backward compatibility with documents written before this policy
 * (some still have the old 5000 ceiling stored); this function
 * deliberately never treats `group.maximumNumber` as a real limit, only
 * `group.minimumNumber` as a floor, so pre-existing code groups become
 * unlimited immediately with no migration needed. ABSOLUTE_CEILING below is
 * a defensive sanity bound against garbage input, not a product limit.
 *
 * An Inv.code, once assigned, is reserved forever — disposing, archiving or
 * otherwise retiring the asset it belongs to never frees the number for
 * reuse. The next number is always one past the highest number this prefix
 * has EVER used, not the lowest number that happens to be free right now.
 *
 * `nextAvailableNumber` (the code group's own persisted counter) is the
 * primary source of truth, but this also folds in every codeNumber already
 * present on `existingAssets` for the same prefix — active, borrowed,
 * repaired, damaged, archived or disposed, it doesn't matter — as a
 * self-healing floor. That protects against the counter ever having drifted
 * behind reality (for example a legacy-imported asset that predates this
 * counter), without needing a separate migration pass.
 */
const ABSOLUTE_CEILING = 1_000_000_000;

export function allocateAssetCodeNumber(
  group: { minimumNumber: number; nextAvailableNumber: number },
  existingAssets: readonly { codePrefix: string; codeNumber: number }[],
  prefix: string,
  requested?: number,
): { number: number } | { error: "already-used" | "range-exhausted" } {
  const normalizedPrefix = prefix.toUpperCase();
  const highestEverUsed = existingAssets.reduce(
    (max, asset) =>
      asset.codePrefix.toUpperCase() === normalizedPrefix
        ? Math.max(max, asset.codeNumber)
        : max,
    group.nextAvailableNumber - 1,
  );
  const floor = Math.max(group.minimumNumber, highestEverUsed + 1);
  if (requested) {
    if (requested < floor) return { error: "already-used" };
    if (requested < group.minimumNumber || requested > ABSOLUTE_CEILING)
      return { error: "range-exhausted" };
    return { number: requested };
  }
  if (floor > ABSOLUTE_CEILING) return { error: "range-exhausted" };
  return { number: floor };
}
