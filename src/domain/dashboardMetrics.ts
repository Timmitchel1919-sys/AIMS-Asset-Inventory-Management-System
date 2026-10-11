import {
  ASSET_STATUS_DEFINITIONS,
  normalizeAssetStatus,
  type AssetStatusKey,
} from "./assetStatus";
import type { Asset } from "./types";

/** Display order of the approved status system. */
export const DASHBOARD_STATUS_ORDER: readonly AssetStatusKey[] = [
  "available",
  "assigned",
  "borrowed",
  "reserved",
  "underMaintenance",
  "underRepair",
  "damaged",
  "archived",
];

export interface StatusCount {
  key: AssetStatusKey;
  /** Canonical English status (translated by the UI). */
  status: string;
  count: number;
}

/**
 * Live status distribution, derived from the asset records every time; there
 * are no stored counters. Statuses outside the approved eight (Lost, Missing,
 * Disposed) are not forced into one of them: they are returned as `other`.
 */
export function assetStatusBreakdown(assets: Pick<Asset, "status">[]): {
  counts: StatusCount[];
  other: number;
  total: number;
} {
  const tally = new Map<AssetStatusKey, number>();
  let other = 0;
  for (const asset of assets) {
    const key = normalizeAssetStatus(asset.status);
    if (key) tally.set(key, (tally.get(key) ?? 0) + 1);
    else other += 1;
  }
  return {
    counts: DASHBOARD_STATUS_ORDER.map((key) => ({
      key,
      status: ASSET_STATUS_DEFINITIONS[key].status,
      count: tally.get(key) ?? 0,
    })),
    other,
    total: assets.length,
  };
}
