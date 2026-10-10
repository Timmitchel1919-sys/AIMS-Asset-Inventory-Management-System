import type { ReferenceRecord, SystemUser } from "../data/contracts";
import type { Asset } from "./types";

/**
 * Read an asset's category, department and assignee through the canonical id
 * references, so a renamed department/category or a renamed user shows up
 * everywhere without rewriting every asset. When an asset has no id yet (not
 * migrated), or the id no longer resolves, the stored text is used, so nothing
 * ever disappears from a screen.
 */
const byId = <T extends { id: string }>(list: T[], id?: string | null) =>
  id ? list.find((item) => item.id === id) : undefined;

export function assetCategoryName(asset: Asset, references: ReferenceRecord[]) {
  const record = byId(
    references.filter((r) => r.kind === "category"),
    asset.categoryId,
  );
  return record?.name || asset.category;
}

export function assetDepartmentName(asset: Asset, references: ReferenceRecord[]) {
  const record = byId(
    references.filter((r) => r.kind === "department"),
    asset.departmentId,
  );
  return record?.name || asset.department;
}

export function assetAssigneeName(asset: Asset, users: SystemUser[]) {
  return byId(users, asset.assignedUserId)?.name || asset.assignedTo || "";
}

/**
 * Membership by id when the asset has one, otherwise by name. An id that
 * points at a DIFFERENT record always means "not this one", even if the old
 * text still matches (the id is the authority once it is set).
 */
export function assetInDepartment(
  asset: Asset,
  department: { id: string; name: string },
) {
  return asset.departmentId
    ? asset.departmentId === department.id
    : asset.department === department.name;
}

export function assetInCategory(
  asset: Asset,
  category: { id: string; name: string },
) {
  return asset.categoryId
    ? asset.categoryId === category.id
    : asset.category === category.name;
}
