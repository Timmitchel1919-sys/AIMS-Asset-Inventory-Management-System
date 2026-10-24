import { useMemo } from "react";
import type { Asset } from "../../../../domain/types";
import type { LocationType, ReferenceRecord } from "../../../../data/contracts";
import {
  childLocations,
  isSameOrDescendant,
  rootLocations,
} from "../../../../domain/locationTree";

interface Props {
  nl: boolean;
  references: ReferenceRecord[];
  locationTypes: LocationType[];
  assets: Asset[];
  maxVisible?: number;
}

interface LocRow {
  id: string | null;
  name: string;
  typeCode: string | null;
  typeLabel: string | null;
  status: string;
  isUnassigned: boolean;
  activeAssets: number;
  childCount: number;
}

const INACTIVE_STATUSES = new Set<string>(["Disposed", "Archived"]);

function resolveTypeLabel(
  typeId: string | null | undefined,
  locationTypes: LocationType[],
): { code: string | null; label: string | null } {
  if (!typeId) return { code: null, label: null };
  const t = locationTypes.find((lt) => lt.id === typeId);
  return t ? { code: t.code, label: t.name } : { code: null, label: null };
}

/**
 * One row per top-level active location, plus an "Unassigned location" bucket
 * for assets with no resolvable current location. Each root totals every active
 * asset whose current location is itself OR a descendant of that root — assets
 * are never counted twice, since every asset has at most one currentLocationId
 * and `isSameOrDescendant` walks the real tree.
 */
function buildRows(
  references: ReferenceRecord[],
  locationTypes: LocationType[],
  assets: Asset[],
  nl: boolean,
): LocRow[] {
  const roots = rootLocations(references);
  const rootIdSet = new Set(roots.map((r) => r.id));
  const rows: LocRow[] = [];

  const activeAssets = assets.filter((a) => !INACTIVE_STATUSES.has(a.status));
  const matchedAssetIds = new Set<string>();

  for (const root of roots) {
    let count = 0;
    for (const a of activeAssets) {
      if (!a.currentLocationId) continue;
      if (isSameOrDescendant(references, a.currentLocationId, root.id)) {
        count += 1;
        matchedAssetIds.add(a.id);
      }
    }
    const { code, label } = resolveTypeLabel(root.type, locationTypes);
    rows.push({
      id: root.id,
      name: root.name,
      typeCode: code,
      typeLabel: label,
      status: root.status,
      isUnassigned: false,
      activeAssets: count,
      childCount: childLocations(references, root.id).length,
    });
  }

  // Assets whose currentLocationId points outside any known root (orphans,
  // invalid IDs, or no location at all).
  const unassignedCount = activeAssets.filter(
    (a) => !matchedAssetIds.has(a.id),
  ).length;

  if (unassignedCount > 0) {
    rows.push({
      id: null,
      name: nl ? "Geen locatie" : "Unassigned location",
      typeCode: null,
      typeLabel: null,
      status: "Active",
      isUnassigned: true,
      activeAssets: unassignedCount,
      childCount: 0,
    });
  }

  // Keep roots sorted by their active asset count desc, unassigned last.
  const [regular, extra] = [
    rows.filter((r) => !r.isUnassigned),
    rows.filter((r) => r.isUnassigned),
  ];
  regular.sort((a, b) => b.activeAssets - a.activeAssets);
  // Hint for future-us: unused variable guard
  void rootIdSet;
  return [...regular, ...extra];
}

export function LocationCardsTile({
  nl,
  references,
  locationTypes,
  assets,
  maxVisible = 4,
}: Props) {
  const rows = useMemo(
    () => buildRows(references, locationTypes, assets, nl),
    [references, locationTypes, assets, nl],
  );

  const visible = rows.slice(0, maxVisible);
  const overflow = rows.length - visible.length;

  return (
    <section className="bento-tile" aria-labelledby="bento-loc-title">
      <header className="bento-tile__header">
        <h3 id="bento-loc-title" className="bento-tile__title">
          {nl ? "Locaties" : "Locations"}
        </h3>
        {rows.length > 0 && (
          <span className="bento-tile__chip" aria-label={nl ? "aantal" : "count"}>
            {rows.length}
          </span>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen locaties geconfigureerd." : "No locations configured."}
        </p>
      ) : (
        <>
          <ul className="bento-cards__list">
            {visible.map((row) => (
              <li
                key={row.id ?? "unassigned-location"}
                className={
                  "bento-cards__row" +
                  (row.isUnassigned ? " bento-cards__row--unassigned" : "")
                }
                title={row.name}
              >
                <div className="bento-cards__meta">
                  <p className="bento-cards__name">
                    {row.name}
                    {row.typeCode ? (
                      <span className="bento-cards__badge" aria-label={row.typeLabel ?? row.typeCode}>
                        {row.typeCode}
                      </span>
                    ) : null}
                  </p>
                  <p className="bento-cards__sub">
                    {row.activeAssets.toLocaleString()}{" "}
                    {nl ? "actieve middelen" : "active assets"}
                    {row.childCount > 0 ? (
                      <>
                        {" · "}
                        {row.childCount.toLocaleString()}{" "}
                        {nl ? "sublocaties" : "sub-locations"}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="bento-cards__value">
                  <p className="bento-cards__count">{row.activeAssets.toLocaleString()}</p>
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
              {nl ? "meer locaties" : "more locations"}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default LocationCardsTile;
