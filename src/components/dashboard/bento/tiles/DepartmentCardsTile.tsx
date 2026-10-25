import { useMemo } from "react";
import type { Asset } from "../../../../domain/types";
import type { ReferenceRecord } from "../../../../data/contracts";
import {
  assetsForDepartment,
  departmentAssetSummary,
} from "../../../../domain/departmentIntelligence";

interface Props {
  nl: boolean;
  references: ReferenceRecord[];
  assets: Asset[];
  maxVisible?: number;
}

interface DeptRow {
  id: string | null;
  name: string;
  status: string;
  isUnassigned: boolean;
  total: number;
  active: number;
  assigned: number;
  maintenance: number;
}

/**
 * One row per active department reference, plus a single "Unassigned" bucket
 * for assets that have no departmentId and no resolvable department name.
 * All counts reuse the shared `departmentAssetSummary()` so numbers reconcile
 * exactly with other AIMS surfaces (live Dashboard, department views, …).
 */
function buildRows(
  references: ReferenceRecord[],
  assets: Asset[],
  nl: boolean,
): DeptRow[] {
  const departments = references
    .filter((r) => r.kind === "department" && r.status !== "Archived")
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows: DeptRow[] = [];
  const matchedAssetIds = new Set<string>();

  for (const dept of departments) {
    const members = assetsForDepartment(assets, dept.name, dept.id);
    for (const a of members) matchedAssetIds.add(a.id);
    const sum = departmentAssetSummary(members, references);
    rows.push({
      id: dept.id,
      name: dept.name,
      status: dept.status,
      isUnassigned: false,
      total: sum.total,
      active: sum.active,
      assigned: sum.assigned,
      maintenance: sum.maintenance,
    });
  }

  const unassigned = assets.filter((a) => !matchedAssetIds.has(a.id));
  if (unassigned.length > 0) {
    const sum = departmentAssetSummary(unassigned, references);
    rows.push({
      id: null,
      name: nl ? "Niet toegewezen" : "Unassigned",
      status: "Active",
      isUnassigned: true,
      total: sum.total,
      active: sum.active,
      assigned: sum.assigned,
      maintenance: sum.maintenance,
    });
  }

  // Sort by active count descending so the busiest department leads.
  // Keep the Unassigned bucket at the end regardless.
  const [regular, extra] = [
    rows.filter((r) => !r.isUnassigned),
    rows.filter((r) => r.isUnassigned),
  ];
  regular.sort((a, b) => b.active - a.active);
  return [...regular, ...extra];
}

export function DepartmentCardsTile({
  nl,
  references,
  assets,
  maxVisible = 4,
}: Props) {
  const rows = useMemo(
    () => buildRows(references, assets, nl),
    [references, assets, nl],
  );

  const visible = rows.slice(0, maxVisible);
  const overflow = rows.length - visible.length;

  return (
    <section className="bento-tile" aria-labelledby="bento-dept-title">
      <header className="bento-tile__header">
        <h3 id="bento-dept-title" className="bento-tile__title">
          {nl ? "Afdelingen" : "Departments"}
        </h3>
        {rows.length > 0 && (
          <span className="bento-tile__chip" aria-label={nl ? "aantal" : "count"}>
            {rows.length}
          </span>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen afdelingen geconfigureerd." : "No departments configured."}
        </p>
      ) : (
        <>
          <ul className="bento-cards__list">
            {visible.map((row) => (
              <li
                key={row.id ?? "unassigned"}
                className={
                  "bento-cards__row" +
                  (row.isUnassigned ? " bento-cards__row--unassigned" : "")
                }
                title={row.name}
              >
                <div className="bento-cards__meta">
                  <p className="bento-cards__name">{row.name}</p>
                  <p className="bento-cards__sub">
                    {row.assigned.toLocaleString()}{" "}
                    {nl ? "toegewezen" : "assigned"}
                    {row.maintenance > 0 ? (
                      <>
                        {" · "}
                        {row.maintenance.toLocaleString()}{" "}
                        {nl ? "in onderhoud" : "in service"}
                      </>
                    ) : null}
                    {row.total - row.active > 0 ? (
                      <>
                        {" · "}
                        {(row.total - row.active).toLocaleString()}{" "}
                        {nl ? "afgeschreven" : "retired"}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="bento-cards__value">
                  <p
                    className="bento-cards__count"
                    title={
                      nl
                        ? `Actieve middelen (totaal inclusief afgeschreven: ${row.total})`
                        : `Active assets (total including retired: ${row.total})`
                    }
                  >
                    {row.active.toLocaleString()}
                  </p>
                  {row.status !== "Active" && !row.isUnassigned ? (
                    <p className="bento-cards__status">{row.status}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {overflow > 0 && (
            <p className="bento-cards__overflow" aria-live="polite">
              +{overflow.toLocaleString()}{" "}
              {nl ? "meer afdelingen" : "more departments"}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default DepartmentCardsTile;
