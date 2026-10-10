import { describe, expect, it } from "vitest";
import { assets } from "../data/mock";
import {
  defaultPolicyRules,
  deviceHealth,
  evaluateCompliance,
  normalizePolicyRules,
  validateCommandRequest,
  type DevicePolicy,
} from "./deviceManagement";
import type { Asset } from "./types";

const NOW = Date.parse("2026-06-01");
const base = {
  ...assets[0],
  status: "Available",
  condition: "Good",
  warrantyExpiry: "2028-01-01",
  purchaseDate: "2025-01-01",
  assignedTo: "Teacher",
  maintenanceRequired: false,
  usefulLifeEnd: undefined,
} as Asset;
const policy = (rules: Partial<DevicePolicy["rules"]> = {}): DevicePolicy => ({
  id: "p1",
  name: "Standard",
  description: "",
  active: true,
  rules: { ...defaultPolicyRules, ...rules },
});

describe("device compliance", () => {
  it("is compliant without an active policy", () => {
    expect(evaluateCompliance(base, undefined, NOW).compliant).toBe(true);
    expect(
      evaluateCompliance({ ...base, status: "Lost" }, { ...policy(), active: false }, NOW)
        .compliant,
    ).toBe(true);
  });
  it("reports every violated rule", () => {
    const result = evaluateCompliance(
      { ...base, warrantyExpiry: "2020-01-01", assignedTo: "", condition: "Poor", status: "Lost", purchaseDate: "2010-01-01" },
      policy({ requireAssignee: true, maxAgeYears: 5, allowedConditions: ["Good", "New"] }),
      NOW,
    );
    expect(result.compliant).toBe(false);
    expect(result.violations.sort()).toEqual(
      ["condition-not-allowed", "no-assignee", "status-blocked", "too-old", "warranty-expired"].sort(),
    );
  });
  it("treats a missing warranty date as expired when a warranty is required", () => {
    expect(
      evaluateCompliance({ ...base, warrantyExpiry: "" }, policy(), NOW).violations,
    ).toContain("warranty-expired");
  });
});

describe("device health", () => {
  it("scores a good device as healthy", () => {
    expect(deviceHealth(base, NOW)).toMatchObject({ score: 100, level: "healthy" });
  });
  it("downgrades poor, expired and lost devices", () => {
    const worn = deviceHealth(
      { ...base, condition: "Poor", warrantyExpiry: "2020-01-01", maintenanceRequired: true },
      NOW,
    );
    expect(worn.level).toBe("critical");
    expect(worn.reasons).toEqual(
      expect.arrayContaining(["poor-condition", "warranty-expired", "maintenance-due"]),
    );
    expect(deviceHealth({ ...base, status: "Lost" }, NOW).level).toBe("attention");
    expect(deviceHealth({ ...base, status: "Lost", condition: "Bad" }, NOW).level).toBe("critical");
  });
  it("never leaves the 0-100 range", () => {
    const score = deviceHealth(
      { ...base, status: "Damaged", condition: "Beyond Repair", warrantyExpiry: "2000-01-01", maintenanceRequired: true, usefulLifeEnd: "2001-01-01" },
      NOW,
    ).score;
    expect(score).toBe(0);
  });
});

describe("device command validation", () => {
  const target = { assetId: "a1", assetCode: "LT-01" };
  it("requires targets and a bounded batch", () => {
    expect(validateCommandRequest({ type: "restart", reason: "", targets: [] })).toBe("no-targets");
    expect(
      validateCommandRequest({ type: "restart", reason: "", targets: Array.from({ length: 101 }, () => target) }),
    ).toBe("too-many");
  });
  it("demands a reason for sensitive commands only", () => {
    expect(validateCommandRequest({ type: "wipe", reason: "no", targets: [target] })).toBe("reason-required");
    expect(validateCommandRequest({ type: "wipe", reason: "Device stolen, case 12", targets: [target] })).toBeNull();
    expect(validateCommandRequest({ type: "locate", reason: "", targets: [target] })).toBeNull();
  });
  it("rejects unknown command types", () => {
    expect(
      validateCommandRequest({ type: "format-disk" as never, reason: "long enough", targets: [target] }),
    ).toBe("bad-type");
  });
});

describe("policy normalisation", () => {
  it("clamps and defaults rules", () => {
    expect(normalizePolicyRules({ maxAgeYears: -3 }).maxAgeYears).toBeNull();
    expect(normalizePolicyRules({ maxAgeYears: 500 }).maxAgeYears).toBe(50);
    expect(normalizePolicyRules({}).requireValidWarranty).toBe(true);
  });
});
