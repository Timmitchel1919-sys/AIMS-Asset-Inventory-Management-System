import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MASTER_DATA_DELETE_EMAILS, canDeleteMasterData } from "./masterDataDeletion";

describe("Master Data deletion policy", () => {
  it("allows exactly the three authorized accounts, case-insensitively", () => {
    expect(MASTER_DATA_DELETE_EMAILS).toHaveLength(3);
    expect(canDeleteMasterData("sastropawiroe@kangoeroeschool.com")).toBe(true);
    expect(canDeleteMasterData("aliendas@kangoeroeschool.com")).toBe(true);
    expect(canDeleteMasterData(" Manager-ICT@kangoeroeschool.com ")).toBe(true);
  });
  it("denies everyone else, including lookalike domains", () => {
    expect(canDeleteMasterData("someone@kangoeroeschool.com")).toBe(false);
    expect(canDeleteMasterData("aliendas@kangoeroeschool.com.evil.io")).toBe(false);
    expect(canDeleteMasterData("aliendas@gmail.com")).toBe(false);
    expect(canDeleteMasterData(undefined)).toBe(false);
    expect(canDeleteMasterData("")).toBe(false);
  });
  it("is enforced by the Cloud Function; Rules forbid client archive/delete outright", () => {
    const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
    const fn = readFileSync(new URL("../../functions/masterData.js", import.meta.url), "utf8");
    for (const email of MASTER_DATA_DELETE_EMAILS) expect(fn).toContain(`"${email}"`);
    // No client path remains, not even for the authorized accounts.
    expect(rules).not.toContain("canDeleteMasterData");
    const group = rules.slice(rules.indexOf("match /codeGroups/{id}"), rules.indexOf("match /assetTypes/{id}"));
    expect(group).toContain("allow delete: if false;");
    expect(rules).toContain("collectionName == 'locations'");
    expect(rules).toContain("resource.data.get('type', '') != 'Main location'");
  });
});
