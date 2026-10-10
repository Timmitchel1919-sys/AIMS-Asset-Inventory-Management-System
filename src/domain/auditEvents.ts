/**
 * Canonical audit event names for the foundational data (Hoofdlocaties,
 * Codegroepen, Categories, Assets and Inv.codes). Every successful command
 * keeps its existing `action` in the activity log; these names are stored in an
 * additional `event` field so existing history and filters keep working.
 */
export const AUDIT_EVENTS = [
  "CODEGROUP_CREATED",
  "CODEGROUP_UPDATED",
  "CODEGROUP_ARCHIVED",
  "LOCATION_CREATED",
  "LOCATION_UPDATED",
  "LOCATION_ARCHIVED",
  "LOCATION_DELETED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_ARCHIVED",
  "CATEGORY_DELETED",
  "ASSET_CREATED",
  "ASSET_UPDATED",
  "INVENTORY_CODE_ASSIGNED",
] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export interface AuditContext {
  /** Reference kind of the record a reference.* command acts on. */
  referenceKind?: string;
  /** asset.edit carried an administrative Inv.code correction. */
  codeCorrection?: boolean;
}

type Verb = "CREATED" | "UPDATED" | "ARCHIVED" | "DELETED";
const verbOf = (suffix: string): Verb | null =>
  suffix === "create"
    ? "CREATED"
    : suffix === "archive"
      ? "ARCHIVED"
      : suffix === "delete"
        ? "DELETED"
        : ["edit", "restore", "activate", "deactivate", "reorder"].includes(suffix)
          ? "UPDATED"
          : null;

/**
 * Events for a SUCCESSFUL command (never call this for a failure).
 * Returns an empty list for commands outside the foundational data.
 */
export function auditEventsFor(action: string, context: AuditContext = {}): AuditEvent[] {
  const [domain, suffix = ""] = action.split(".");
  const verb = verbOf(suffix);
  const pick = (name: string): AuditEvent[] => {
    const candidate = `${name}_${verb}` as AuditEvent;
    return verb && (AUDIT_EVENTS as readonly string[]).includes(candidate) ? [candidate] : [];
  };
  switch (domain) {
    case "codeGroup":
      // Deleting a code group moves it to the recycle bin: an archive.
      return suffix === "delete" ? ["CODEGROUP_ARCHIVED"] : pick("CODEGROUP");
    case "reference": {
      const kind = context.referenceKind;
      if (kind === "location") return pick("LOCATION");
      if (kind === "category" || kind === "subcategory") return pick("CATEGORY");
      return [];
    }
    case "asset":
      if (suffix === "create") return ["ASSET_CREATED", "INVENTORY_CODE_ASSIGNED"];
      if (suffix === "edit")
        return context.codeCorrection
          ? ["ASSET_UPDATED", "INVENTORY_CODE_ASSIGNED"]
          : ["ASSET_UPDATED"];
      return [];
    default:
      return [];
  }
}
