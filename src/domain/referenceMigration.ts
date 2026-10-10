import type { CodeGroup, ReferenceRecord, SystemUser } from "../data/contracts";
import { assetTypeId, type AssetTypeRecord } from "./assetTypes";
import type { Asset } from "./types";

/**
 * Step 2 of the data foundation: fill the canonical reference ids on assets
 * from the text fields they already have. The planner is pure and read-only;
 * a separate, explicit apply step writes only the proposals it returns.
 *
 * Safety rules:
 *  - only EMPTY id fields are ever filled; an existing id is never overwritten
 *  - a field is proposed only on an exact, UNIQUE match; anything ambiguous or
 *    unmatched stays empty and is reported
 *  - the original text fields (category, department, assignedTo, ...) are
 *    never touched, so nothing is lost and the migration is reversible
 */
export const REFERENCE_FIELDS = [
  "categoryId",
  "assetTypeId",
  "codeGroupId",
  "departmentId",
  "assignedUserId",
] as const;
export type ReferenceField = (typeof REFERENCE_FIELDS)[number];

export type FieldOutcome =
  | "will-fill"
  | "already-set"
  | "conflict" // an id is already set and differs from what the text suggests
  | "ambiguous"
  | "no-match"
  | "not-applicable" // e.g. no assignee, no department
  | "blocked"; // prerequisite missing (default asset type not created yet)

export interface FieldPlan {
  outcome: FieldOutcome;
  /** Proposed id when outcome is "will-fill"; the current id when "already-set". */
  id?: string;
  /** Human-readable candidates or reason, for the report. */
  note?: string;
}

export interface AssetPlan {
  assetId: string;
  code: string;
  fields: Record<ReferenceField, FieldPlan>;
  /** Informational: asset has no canonical Hoofdlocatie reference at all. */
  missingLocation: boolean;
}

export interface MigrationInput {
  assets: Asset[];
  references: ReferenceRecord[];
  codeGroups: CodeGroup[];
  users: SystemUser[];
  assetTypes: AssetTypeRecord[];
  /** Behavior assigned when an asset has no tracking type yet. */
  defaultAssetTypeName?: string;
}

export interface MigrationSummary {
  totalAssets: number;
  assetsWithChanges: number;
  perField: Record<ReferenceField, Record<FieldOutcome, number>>;
  missingLocation: number;
}

export interface MigrationReport {
  plans: AssetPlan[];
  summary: MigrationSummary;
  /** Distinct text values that could not be matched, per field (for fixing master data). */
  unmatched: Record<ReferenceField, { value: string; count: number }[]>;
}

export const normalizeKey = (value?: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const emptyOutcomes = (): Record<FieldOutcome, number> => ({
  "will-fill": 0,
  "already-set": 0,
  conflict: 0,
  ambiguous: 0,
  "no-match": 0,
  "not-applicable": 0,
  blocked: 0,
});

/**
 * Decide one field. An existing id always wins and is never overwritten:
 * it is "already-set" when it agrees with (or the text says nothing about) the
 * candidates, otherwise a "conflict" that is only reported.
 */
function resolve(
  current: string | null | undefined,
  candidates: { id: string; label: string }[],
  textEmpty: boolean,
): FieldPlan {
  if (current) {
    return textEmpty || candidates.some((c) => c.id === current)
      ? { outcome: "already-set", id: current }
      : { outcome: "conflict", id: current };
  }
  if (textEmpty) return { outcome: "not-applicable" };
  if (candidates.length === 1) return { outcome: "will-fill", id: candidates[0].id };
  if (candidates.length === 0) return { outcome: "no-match" };
  return { outcome: "ambiguous", note: candidates.map((c) => c.label).join(" | ") };
}

export function planReferenceMigration(input: MigrationInput): MigrationReport {
  const { assets, references, codeGroups, users, assetTypes } = input;
  const categoryRefs = references.filter(
    (r) => r.kind === "category" && r.status !== "Archived",
  );
  const departmentRefs = references.filter(
    (r) => r.kind === "department" && r.status !== "Archived",
  );
  const activeGroups = codeGroups.filter((g) => !g.archived);
  const defaultTypeId = assetTypeId(input.defaultAssetTypeName ?? "Serialized");
  const defaultType = assetTypes.find(
    (t) => t.id === defaultTypeId && t.status !== "Archived",
  );

  const plans: AssetPlan[] = [];
  const unmatchedCounts = Object.fromEntries(
    REFERENCE_FIELDS.map((f) => [f, new Map<string, number>()]),
  ) as Record<ReferenceField, Map<string, number>>;
  const note = (field: ReferenceField, value: string) =>
    unmatchedCounts[field].set(value, (unmatchedCounts[field].get(value) ?? 0) + 1);

  for (const asset of assets) {
    const fields = {} as Record<ReferenceField, FieldPlan>;

    // categoryId: the asset's `category` text names a classification record.
    {
      const key = normalizeKey(asset.category);
      const matches = categoryRefs
        .filter((r) => normalizeKey(r.name) === key)
        // Prefer the asset-type level ("Laptops") over a same-named top level.
        .sort(
          (a, b) =>
            Number(b.details?.level === "asset_name") -
            Number(a.details?.level === "asset_name"),
        );
      const preferred = matches.filter(
        (m) => m.details?.level === matches[0]?.details?.level,
      );
      fields.categoryId = resolve(
        asset.categoryId,
        preferred.map((m) => ({ id: m.id, label: m.name })),
        !key,
      );
      if (fields.categoryId.outcome === "no-match" || fields.categoryId.outcome === "ambiguous")
        note("categoryId", asset.category);
    }

    // assetTypeId: default tracking type; asset-level overrides come later.
    if (asset.assetTypeId) fields.assetTypeId = { outcome: "already-set", id: asset.assetTypeId };
    else if (!defaultType)
      fields.assetTypeId = {
        outcome: "blocked",
        note: `Create the "${input.defaultAssetTypeName ?? "Serialized"}" tracking type first.`,
      };
    else fields.assetTypeId = { outcome: "will-fill", id: defaultType.id };

    // codeGroupId: the code prefix is unique per code group.
    {
      const prefix = normalizeKey(asset.codePrefix);
      const matches = activeGroups.filter((g) => normalizeKey(g.prefix) === prefix);
      const archivedMatch = codeGroups.filter(
        (g) => g.archived && normalizeKey(g.prefix) === prefix,
      );
      const candidates = matches.length ? matches : archivedMatch;
      fields.codeGroupId = resolve(
        asset.codeGroupId,
        candidates.map((g) => ({ id: g.id, label: `${g.name} (${g.prefix})` })),
        !prefix,
      );
      if (fields.codeGroupId.outcome === "no-match" || fields.codeGroupId.outcome === "ambiguous")
        note("codeGroupId", asset.codePrefix);
    }

    // departmentId: match on name; the Hoofdlocatie breaks ties.
    {
      const key = normalizeKey(asset.department);
      let matches = departmentRefs.filter((d) => normalizeKey(d.name) === key);
      if (matches.length > 1 && asset.mainLocationId) {
        const narrowed = matches.filter((d) => d.mainLocationId === asset.mainLocationId);
        if (narrowed.length >= 1) matches = narrowed;
      }
      fields.departmentId = resolve(
        asset.departmentId,
        matches.map((d) => ({ id: d.id, label: `${d.name} (${d.id})` })),
        !key,
      );
      if (fields.departmentId.outcome === "no-match" || fields.departmentId.outcome === "ambiguous")
        note("departmentId", asset.department);
    }

    // assignedUserId: match the assignee text on exact name or email.
    {
      const key = normalizeKey(asset.assignedTo);
      const matches = users.filter(
        (u) => normalizeKey(u.name) === key || normalizeKey(u.email) === key,
      );
      fields.assignedUserId = resolve(
        asset.assignedUserId,
        matches.map((u) => ({ id: u.id, label: `${u.name} <${u.email}>` })),
        !key,
      );
      if (fields.assignedUserId.outcome === "no-match" || fields.assignedUserId.outcome === "ambiguous")
        note("assignedUserId", asset.assignedTo ?? "");
    }

    plans.push({
      assetId: asset.id,
      code: asset.code,
      fields,
      missingLocation: !asset.mainLocationId && !asset.currentLocationId,
    });
  }

  const perField = Object.fromEntries(
    REFERENCE_FIELDS.map((f) => [f, emptyOutcomes()]),
  ) as Record<ReferenceField, Record<FieldOutcome, number>>;
  for (const plan of plans)
    for (const f of REFERENCE_FIELDS) perField[f][plan.fields[f].outcome] += 1;

  return {
    plans,
    summary: {
      totalAssets: assets.length,
      assetsWithChanges: plans.filter((p) => changesOf(p).length > 0).length,
      perField,
      missingLocation: plans.filter((p) => p.missingLocation).length,
    },
    unmatched: Object.fromEntries(
      REFERENCE_FIELDS.map((f) => [
        f,
        [...unmatchedCounts[f]]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      ]),
    ) as MigrationReport["unmatched"],
  };
}

/** The (field, id) pairs a plan would write — only unambiguous "will-fill" ones. */
export function changesOf(plan: AssetPlan): { field: ReferenceField; id: string }[] {
  return REFERENCE_FIELDS.flatMap((field) => {
    const f = plan.fields[field];
    return f.outcome === "will-fill" && f.id ? [{ field, id: f.id }] : [];
  });
}

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

/** One row per asset and field that needs attention or will change. */
export function reportToCsv(report: MigrationReport): string {
  const rows = [["Inv.code", "Field", "Outcome", "Proposed/current id", "Note"]];
  for (const plan of report.plans)
    for (const field of REFERENCE_FIELDS) {
      const f = plan.fields[field];
      if (f.outcome === "already-set" || f.outcome === "not-applicable") continue;
      rows.push([plan.code, field, f.outcome, f.id ?? "", f.note ?? ""]);
    }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
