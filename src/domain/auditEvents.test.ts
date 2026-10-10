import { describe, expect, it } from "vitest";
import { AUDIT_EVENTS, auditEventsFor } from "./auditEvents";

describe("auditEventsFor", () => {
  it("names code group events and treats the recycle-bin delete as an archive", () => {
    expect(auditEventsFor("codeGroup.create")).toEqual(["CODEGROUP_CREATED"]);
    expect(auditEventsFor("codeGroup.edit")).toEqual(["CODEGROUP_UPDATED"]);
    expect(auditEventsFor("codeGroup.deactivate")).toEqual(["CODEGROUP_UPDATED"]);
    expect(auditEventsFor("codeGroup.delete")).toEqual(["CODEGROUP_ARCHIVED"]);
    expect(auditEventsFor("codeGroup.restore")).toEqual(["CODEGROUP_UPDATED"]);
  });
  it("maps reference commands by the kind of record", () => {
    expect(auditEventsFor("reference.create", { referenceKind: "location" })).toEqual(["LOCATION_CREATED"]);
    expect(auditEventsFor("reference.archive", { referenceKind: "location" })).toEqual(["LOCATION_ARCHIVED"]);
    expect(auditEventsFor("reference.delete", { referenceKind: "location" })).toEqual(["LOCATION_DELETED"]);
    expect(auditEventsFor("reference.edit", { referenceKind: "category" })).toEqual(["CATEGORY_UPDATED"]);
    expect(auditEventsFor("reference.edit", { referenceKind: "subcategory" })).toEqual(["CATEGORY_UPDATED"]);
    expect(auditEventsFor("reference.restore", { referenceKind: "category" })).toEqual(["CATEGORY_UPDATED"]);
    // Departments are outside the foundational events.
    expect(auditEventsFor("reference.create", { referenceKind: "department" })).toEqual([]);
    expect(auditEventsFor("reference.create")).toEqual([]);
  });
  it("records the Inv.code assignment together with asset creation and corrections", () => {
    expect(auditEventsFor("asset.create")).toEqual(["ASSET_CREATED", "INVENTORY_CODE_ASSIGNED"]);
    expect(auditEventsFor("asset.edit")).toEqual(["ASSET_UPDATED"]);
    expect(auditEventsFor("asset.edit", { codeCorrection: true })).toEqual(["ASSET_UPDATED", "INVENTORY_CODE_ASSIGNED"]);
  });
  it("ignores everything else and only returns declared events", () => {
    expect(auditEventsFor("assignment.create")).toEqual([]);
    expect(auditEventsFor("asset.archive")).toEqual([]);
    const all = ["codeGroup.create", "codeGroup.edit", "codeGroup.delete", "asset.create", "asset.edit"].flatMap((a) => auditEventsFor(a, { codeCorrection: true }));
    for (const event of all) expect(AUDIT_EVENTS).toContain(event);
  });
});
