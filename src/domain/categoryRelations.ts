import type { CodeGroup, ReferenceRecord } from "../data/contracts";

/**
 * Explicit category relations, stored on the category record itself:
 *  - details.codeGroupId   the default Codegroep (stable id). The legacy
 *                          details.codeGroup (the prefix) stays in step and is
 *                          used as a fallback for records that have no id yet.
 *  - details.allowedAssetTypeIds   tracking types (assetTypes ids) permitted for
 *                          assets of this category. EMPTY MEANS ANY: nothing is
 *                          restricted until an administrator configures it, so
 *                          legitimate future configurations are never blocked.
 * A category is NOT a Codegroep; these are independent, optional links.
 */
export interface CategoryRelations {
  codeGroup?: CodeGroup;
  allowedAssetTypeIds: string[];
  /** Record the relations were read from (for messages). */
  source?: ReferenceRecord;
}

const key = (value?: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export const readAllowedAssetTypeIds = (record?: ReferenceRecord): string[] => {
  const raw = record?.details?.allowedAssetTypeIds;
  return Array.isArray(raw)
    ? [...new Set(raw.filter((v): v is string => typeof v === "string" && !!v))]
    : [];
};

/** The classification record an asset's `category` text refers to. */
export function findCategoryRecord(
  categoryName: string | undefined,
  references: ReferenceRecord[],
): ReferenceRecord | undefined {
  const name = key(categoryName);
  if (!name) return undefined;
  const matches = references.filter(
    (r) => r.kind === "category" && r.status !== "Archived" && key(r.name) === name,
  );
  // Prefer the asset-type level ("Laptops") over a same-named top level.
  const assetLevel = matches.filter((r) => r.details?.level === "asset_name");
  const pool = assetLevel.length ? assetLevel : matches;
  return pool.length === 1 ? pool[0] : undefined;
}

function groupOf(
  record: ReferenceRecord | undefined,
  codeGroups: CodeGroup[],
): CodeGroup | undefined {
  if (!record) return undefined;
  const live = codeGroups.filter((g) => !g.archived && g.isActive !== false);
  const id = record.details?.codeGroupId;
  if (typeof id === "string" && id) {
    const byId = live.find((g) => g.id === id);
    if (byId) return byId;
  }
  const prefix = key(String(record.details?.codeGroup ?? ""));
  if (!prefix) return undefined;
  const byPrefix = live.filter((g) => key(g.prefix) === prefix);
  return byPrefix.length === 1 ? byPrefix[0] : undefined;
}

/**
 * Relations that apply to an asset category, inheriting from the parent
 * (top-level) category for anything the specific record does not define.
 */
export function effectiveCategoryRelations(
  categoryName: string | undefined,
  references: ReferenceRecord[],
  codeGroups: CodeGroup[],
): CategoryRelations {
  const own = findCategoryRecord(categoryName, references);
  if (!own) return { allowedAssetTypeIds: [] };
  const parentId = own.details?.categoryId;
  const parent =
    typeof parentId === "string" && parentId
      ? references.find((r) => r.id === parentId && r.kind === "category")
      : undefined;
  const allowed = readAllowedAssetTypeIds(own);
  return {
    codeGroup: groupOf(own, codeGroups) ?? groupOf(parent, codeGroups),
    allowedAssetTypeIds: allowed.length ? allowed : readAllowedAssetTypeIds(parent),
    source: own,
  };
}

/** Empty list = any tracking type is allowed. An unset type is always fine. */
export const assetTypeAllowed = (
  assetTypeId: string | null | undefined,
  relations: Pick<CategoryRelations, "allowedAssetTypeIds">,
) =>
  !assetTypeId ||
  relations.allowedAssetTypeIds.length === 0 ||
  relations.allowedAssetTypeIds.includes(assetTypeId);

export const ASSET_TYPE_NOT_ALLOWED = {
  nl: "Dit beheertype is niet toegestaan voor de gekozen categorie.",
  en: "This tracking type is not allowed for the selected category.",
} as const;
