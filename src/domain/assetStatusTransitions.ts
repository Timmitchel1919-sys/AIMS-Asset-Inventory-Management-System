import type { AssetStatus } from "./types";

/**
 * Logical lifecycle of an asset's operational status.
 *
 * "Available" is the hub: an asset that is lost, in repair, etc. returns to
 * Available when the situation is resolved. Terminal states (Disposed,
 * Archived) are left only through their own audited workflows (disposal
 * completion, archive/restore), never through a plain edit.
 */
export const ASSET_STATUS_TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  Available: ["Assigned", "Borrowed", "Reserved", "Under Repair", "Under Maintenance", "Damaged", "Lost", "Missing", "Disposed", "Archived"],
  Assigned: ["Available", "Borrowed", "Under Repair", "Under Maintenance", "Damaged", "Lost", "Missing"],
  Borrowed: ["Available", "Assigned", "Under Repair", "Under Maintenance", "Damaged", "Lost", "Missing"],
  Reserved: ["Available", "Assigned", "Borrowed", "Under Repair", "Under Maintenance", "Damaged"],
  // After work the asset goes back to whoever still holds it (Assigned or
  // Borrowed) or to Available; "needs a user" is enforced by validateAssetState.
  "Under Repair": ["Available", "Assigned", "Borrowed", "Under Maintenance", "Damaged", "Disposed", "Archived"],
  "Under Maintenance": ["Available", "Assigned", "Borrowed", "Under Repair", "Damaged"],
  Damaged: ["Available", "Under Repair", "Disposed", "Archived"],
  Lost: ["Available", "Missing", "Disposed", "Archived"],
  Missing: ["Available", "Lost", "Disposed", "Archived"],
  Disposed: [],
  Archived: [],
};

/** Statuses an asset can move to from `from` (never includes `from` itself). */
export const allowedStatusTargets = (from: AssetStatus): readonly AssetStatus[] =>
  ASSET_STATUS_TRANSITIONS[from] ?? [];

export const canChangeAssetStatus = (from: AssetStatus, to: AssetStatus) =>
  from === to || allowedStatusTargets(from).includes(to);

/** Statuses in which an asset cannot be held by a person. */
const NOT_HELD: readonly AssetStatus[] = ["Available", "Archived", "Disposed"];
/** Statuses that mean "someone has it". */
const HELD: readonly AssetStatus[] = ["Assigned", "Borrowed"];

export type AssetStateError =
  | "transition-not-allowed"
  | "held-without-user"
  | "user-on-unheld-asset";

/**
 * Validates the state an edit would leave an asset in. Only call it when the
 * edit changes the status or the assignee, so records that already violate a
 * rule (legacy data) can still be edited for unrelated reasons.
 */
export function validateAssetState(input: {
  from: AssetStatus;
  to: AssetStatus;
  assignee: string | null | undefined;
}): AssetStateError | null {
  if (!canChangeAssetStatus(input.from, input.to)) return "transition-not-allowed";
  const held = Boolean((input.assignee ?? "").trim());
  if (HELD.includes(input.to) && !held) return "held-without-user";
  if (held && NOT_HELD.includes(input.to)) return "user-on-unheld-asset";
  return null;
}

export const ASSET_STATE_ERRORS = {
  nl: {
    "transition-not-allowed": (from: string, to: string) =>
      `De status kan niet rechtstreeks van "${from}" naar "${to}" worden gewijzigd.`,
    "held-without-user": (_f: string, to: string) =>
      `Voor de status "${to}" is een toegewezen gebruiker vereist.`,
    "user-on-unheld-asset": (_f: string, to: string) =>
      `Een asset met status "${to}" kan niet aan een gebruiker zijn toegewezen. Verwijder eerst de toewijzing.`,
  },
  en: {
    "transition-not-allowed": (from: string, to: string) =>
      `The status cannot be changed directly from "${from}" to "${to}".`,
    "held-without-user": (_f: string, to: string) =>
      `The status "${to}" requires an assigned user.`,
    "user-on-unheld-asset": (_f: string, to: string) =>
      `An asset with status "${to}" cannot be assigned to a user. Remove the assignment first.`,
  },
} as const;
