/**
 * Phase A — location hierarchy helpers.
 *
 * AIMS already models the tree on `ReferenceRecord` (kind === "location") via
 * `containerLocationId` / `parentLocationId` / `parentId` (synonyms used across
 * the codebase) and a root `mainLocationId`. These helpers walk that tree so
 * transfers/returns can capture and display a full path
 * (e.g. "IT Warehouse / Group 6A / Rack A") without a second location system.
 *
 * Sub-location is NOT a separate field: a sub-location is just a location whose
 * parent is another location. The asset's `currentLocationId` points at the
 * leaf (main, sub or bin-level), and `currentLocationPath` is the denormalised
 * string for display and Google Sheets.
 */
import type { ReferenceRecord } from "../data/contracts";

export type LocationRef = ReferenceRecord;

const MAX_DEPTH = 12; // cycle guard

export const isLocation = (r: ReferenceRecord): boolean => r.kind === "location";

export function locationsOf(references: ReferenceRecord[]): LocationRef[] {
  return references.filter(isLocation);
}

export function locationById(
  references: ReferenceRecord[],
  id: string | null | undefined,
): LocationRef | undefined {
  if (!id) return undefined;
  return references.find((r) => r.id === id && isLocation(r));
}

/** The parent location id, however this record happens to store it. */
export function parentLocationIdOf(ref: LocationRef | undefined): string | null {
  if (!ref) return null;
  return (
    ref.containerLocationId ??
    ref.parentLocationId ??
    (ref.parentId && ref.parentId !== ref.id ? ref.parentId : null) ??
    null
  );
}

/** Root → leaf list of location ids for `id` (inclusive), cycle-safe. */
export function locationPathIds(
  references: ReferenceRecord[],
  id: string | null | undefined,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor = locationById(references, id);
  let depth = 0;
  while (cursor && !seen.has(cursor.id) && depth < MAX_DEPTH) {
    seen.add(cursor.id);
    chain.unshift(cursor.id);
    cursor = locationById(references, parentLocationIdOf(cursor));
    depth += 1;
  }
  return chain;
}

/** Root → leaf list of location names. */
export function locationPathNames(
  references: ReferenceRecord[],
  id: string | null | undefined,
): string[] {
  return locationPathIds(references, id).map(
    (pid) => locationById(references, pid)?.name ?? pid,
  );
}

/** "IT Warehouse / Group 6A / Rack A" (optionally with a trailing bin label). */
export function locationPath(
  references: ReferenceRecord[],
  id: string | null | undefined,
  opts: { separator?: string; bin?: string | null } = {},
): string {
  const sep = opts.separator ?? " / ";
  const parts = locationPathNames(references, id);
  if (opts.bin && opts.bin.trim()) parts.push(opts.bin.trim());
  return parts.join(sep);
}

/** The root (top-most) ancestor location id for `id`. */
export function mainLocationIdOf(
  references: ReferenceRecord[],
  id: string | null | undefined,
): string | null {
  return locationPathIds(references, id)[0] ?? null;
}

/** Active locations with no parent — the top level of the tree. */
export function rootLocations(references: ReferenceRecord[]): LocationRef[] {
  return locationsOf(references)
    .filter((r) => r.status === "Active" && !parentLocationIdOf(r))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Active direct children of `parentId`. */
export function childLocations(
  references: ReferenceRecord[],
  parentId: string | null | undefined,
): LocationRef[] {
  if (!parentId) return [];
  return locationsOf(references)
    .filter(
      (r) => r.status === "Active" && parentLocationIdOf(r) === parentId,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Is `id` the same as, or a descendant of, `ancestorId`? (self-move guard) */
export function isSameOrDescendant(
  references: ReferenceRecord[],
  id: string | null | undefined,
  ancestorId: string | null | undefined,
): boolean {
  if (!id || !ancestorId) return false;
  return locationPathIds(references, id).includes(ancestorId);
}
