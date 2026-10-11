import { describe, expect, it } from "vitest";
import {
  ASSET_STATUS_TRANSITIONS,
  allowedStatusTargets,
  canChangeAssetStatus,
  validateAssetState,
} from "./assetStatusTransitions";
import type { AssetStatus } from "./types";

const ALL = Object.keys(ASSET_STATUS_TRANSITIONS) as AssetStatus[];

describe("asset status transitions", () => {
  it("allows the transitions named in the specification", () => {
    for (const [from, to] of [
      ["Available", "Assigned"],
      ["Assigned", "Borrowed"],
      ["Borrowed", "Available"],
      ["Available", "Under Maintenance"],
      ["Under Maintenance", "Available"],
      ["Under Repair", "Available"],
      ["Damaged", "Archived"],
    ] as const)
      expect(canChangeAssetStatus(from, to), `${from} → ${to}`).toBe(true);
  });

  it("every status is defined and only targets known statuses, never itself", () => {
    expect(new Set(ALL).size).toBe(11);
    for (const from of ALL)
      for (const to of allowedStatusTargets(from)) {
        expect(ALL).toContain(to);
        expect(to).not.toBe(from);
      }
  });

  it("terminal states are not left through a plain edit", () => {
    expect(allowedStatusTargets("Disposed")).toEqual([]);
    expect(allowedStatusTargets("Archived")).toEqual([]);
    expect(canChangeAssetStatus("Archived", "Available")).toBe(false);
    expect(canChangeAssetStatus("Disposed", "Available")).toBe(false);
  });

  it("blocks impossible jumps", () => {
    expect(canChangeAssetStatus("Under Repair", "Reserved")).toBe(false);
    expect(canChangeAssetStatus("Under Maintenance", "Archived")).toBe(false);
    expect(canChangeAssetStatus("Lost", "Assigned")).toBe(false);
    expect(canChangeAssetStatus("Assigned", "Archived")).toBe(false);
  });

  it("an unchanged status is always fine", () => {
    for (const status of ALL) expect(canChangeAssetStatus(status, status)).toBe(true);
  });

  it("rejects contradictory states", () => {
    expect(validateAssetState({ from: "Available", to: "Assigned", assignee: "" })).toBe("held-without-user");
    expect(validateAssetState({ from: "Available", to: "Borrowed", assignee: undefined })).toBe("held-without-user");
    expect(validateAssetState({ from: "Assigned", to: "Available", assignee: "Ann" })).toBe("user-on-unheld-asset");
    expect(validateAssetState({ from: "Available", to: "Archived", assignee: "Ann" })).toBe("user-on-unheld-asset");
    expect(validateAssetState({ from: "Archived", to: "Available", assignee: "" })).toBe("transition-not-allowed");
  });

  it("accepts consistent states", () => {
    expect(validateAssetState({ from: "Available", to: "Assigned", assignee: "Ann" })).toBeNull();
    expect(validateAssetState({ from: "Assigned", to: "Available", assignee: "" })).toBeNull();
    // A person may still hold a device that is in for repair or maintenance.
    expect(validateAssetState({ from: "Assigned", to: "Under Repair", assignee: "Ann" })).toBeNull();
    expect(validateAssetState({ from: "Assigned", to: "Assigned", assignee: "Ann" })).toBeNull();
    // Back from work to the person who still holds it, but never to nobody.
    expect(validateAssetState({ from: "Under Maintenance", to: "Assigned", assignee: "Ann" })).toBeNull();
    expect(validateAssetState({ from: "Under Repair", to: "Assigned", assignee: "" })).toBe("held-without-user");
  });
});
