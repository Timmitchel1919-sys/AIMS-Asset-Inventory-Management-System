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
  it("is mirrored server-side by the same list in firestore.rules", () => {
    const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
    const block = rules.slice(rules.indexOf("function canDeleteMasterData"));
    for (const email of MASTER_DATA_DELETE_EMAILS) expect(block.slice(0, 500)).toContain(`'${email}'`);
    expect(rules).toContain("allow delete: if canDeleteMasterData();");
    expect(rules).toContain("collectionName == 'locations'");
  });
});
