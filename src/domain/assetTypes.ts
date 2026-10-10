/**
 * Asset Type = how an asset is tracked (its inventory-management behavior).
 * Not to be confused with the existing second category level that the UI
 * calls "Asset Types" (e.g. "Laptops"): that is a classification. To avoid
 * the clash this concept is labelled "Tracking type" / "Beheertype" in the UI,
 * while the Firestore collection and asset field follow the specification
 * (`assetTypes`, `assetTypeId`).
 */
export const ASSET_TYPE_BEHAVIORS = ["SERIALIZED", "BULK", "CONSUMABLE"] as const;
export type AssetTypeBehavior = (typeof ASSET_TYPE_BEHAVIORS)[number];
export type AssetTypeStatus = "Active" | "Inactive" | "Archived";

export interface AssetTypeRecord {
  /** Deterministic slug of the name; it is the document id, so it is unique. */
  id: string;
  name: string;
  description: string;
  behavior: AssetTypeBehavior;
  status: AssetTypeStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * The three behaviors named in the specification. They are only created when
 * an authorized user asks for them; nothing is created automatically.
 */
export const DEFAULT_ASSET_TYPES: ReadonlyArray<
  Pick<AssetTypeRecord, "name" | "description" | "behavior">
> = [
  { name: "Serialized", behavior: "SERIALIZED", description: "Each physical asset has its own inventory record and Inv.code." },
  { name: "Bulk", behavior: "BULK", description: "Similar items tracked collectively." },
  { name: "Consumable", behavior: "CONSUMABLE", description: "Items consumed through normal use." },
];

export const MAX_ASSET_TYPE_NAME = 80;

export const normalizeAssetTypeName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

/** "  Bulk  Items " and "bulk items" resolve to the same document id. */
export const assetTypeId = (name: string) =>
  normalizeAssetTypeName(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export type AssetTypeError = "name-required" | "name-too-long" | "bad-behavior" | "duplicate";

export function validateAssetType(
  input: { name: string; behavior: string },
  existingIds: Iterable<string>,
  editingId?: string,
): AssetTypeError | null {
  const name = normalizeAssetTypeName(input.name);
  const id = assetTypeId(name);
  if (name.length < 2 || !id) return "name-required";
  if (name.length > MAX_ASSET_TYPE_NAME) return "name-too-long";
  if (!ASSET_TYPE_BEHAVIORS.includes(input.behavior as AssetTypeBehavior))
    return "bad-behavior";
  if (id !== editingId && new Set(existingIds).has(id)) return "duplicate";
  return null;
}

export const ASSET_TYPE_ERRORS = {
  nl: {
    "name-required": "Vul een naam in (minimaal 2 tekens).",
    "name-too-long": "De naam is te lang.",
    "bad-behavior": "Kies een geldig beheergedrag.",
    duplicate: "Deze naam bestaat al.",
  },
  en: {
    "name-required": "Enter a name (at least 2 characters).",
    "name-too-long": "The name is too long.",
    "bad-behavior": "Choose a valid behavior.",
    duplicate: "This name already exists.",
  },
} as const;
