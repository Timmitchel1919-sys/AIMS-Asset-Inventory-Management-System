import type { Asset, AssetStatus, Condition } from "./types";

/**
 * Owner-only Device Management domain. There is no device agent in AIMS, so
 * everything here is derived from the asset register: compliance and health
 * are computed from asset data, and remote commands are only *recorded*
 * (queued) for the audit trail — they are never executed on a device.
 */

export const DEVICE_COMMAND_TYPES = [
  "lock",
  "restart",
  "locate",
  "collect-info",
  "wipe",
] as const;
export type DeviceCommandType = (typeof DEVICE_COMMAND_TYPES)[number];
export type DeviceCommandStatus = "queued" | "cancelled";

/** Commands that are destructive or disruptive and need a written reason. */
export const SENSITIVE_COMMANDS: readonly DeviceCommandType[] = ["wipe", "lock"];
export const MIN_REASON_LENGTH = 5;
export const MAX_BULK_TARGETS = 100;

export interface ManagedDevice {
  /** Document id equals the asset id. */
  assetId: string;
  assetCode: string;
  policyId?: string;
  notes?: string;
  enrolledBy?: string;
  enrolledAt?: string;
}

export interface DevicePolicyRules {
  requireValidWarranty: boolean;
  requireAssignee: boolean;
  /** Null disables the age check. */
  maxAgeYears: number | null;
  allowedConditions: Condition[];
  blockedStatuses: AssetStatus[];
}

export interface DevicePolicy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  rules: DevicePolicyRules;
  updatedBy?: string;
  updatedAt?: string;
}

export interface DeviceCommand {
  id: string;
  assetId: string;
  assetCode: string;
  type: DeviceCommandType;
  status: DeviceCommandStatus;
  reason: string;
  createdBy?: string;
  createdAt?: string;
  batchId?: string;
}

export interface DeviceAuditEntry {
  id: string;
  action: string;
  assetId?: string;
  assetCode?: string;
  detail: string;
  actor?: string;
  createdAt?: string;
}

export const defaultPolicyRules: DevicePolicyRules = {
  requireValidWarranty: true,
  requireAssignee: false,
  maxAgeYears: null,
  allowedConditions: [],
  blockedStatuses: ["Lost", "Missing", "Damaged", "Disposed", "Archived"],
};

export type ViolationCode =
  | "warranty-expired"
  | "no-assignee"
  | "too-old"
  | "condition-not-allowed"
  | "status-blocked";

export interface ComplianceResult {
  compliant: boolean;
  violations: ViolationCode[];
}

const parseDate = (value?: string) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
};
const DAY = 86_400_000;

export function evaluateCompliance(
  asset: Asset,
  policy: DevicePolicy | undefined,
  now = Date.now(),
): ComplianceResult {
  if (!policy || !policy.active) return { compliant: true, violations: [] };
  const rules = policy.rules;
  const violations: ViolationCode[] = [];
  if (rules.requireValidWarranty) {
    const expiry = parseDate(asset.warrantyExpiry);
    if (expiry === null || expiry < now) violations.push("warranty-expired");
  }
  if (rules.requireAssignee && !(asset.assignedTo || "").trim())
    violations.push("no-assignee");
  if (rules.maxAgeYears !== null) {
    const purchased = parseDate(asset.purchaseDate);
    if (purchased !== null && (now - purchased) / (365.25 * DAY) > rules.maxAgeYears)
      violations.push("too-old");
  }
  if (
    rules.allowedConditions.length &&
    !rules.allowedConditions.includes(asset.condition)
  )
    violations.push("condition-not-allowed");
  if (rules.blockedStatuses.includes(asset.status))
    violations.push("status-blocked");
  return { compliant: violations.length === 0, violations };
}

export type HealthLevel = "healthy" | "attention" | "critical";
export interface HealthResult {
  score: number;
  level: HealthLevel;
  reasons: string[];
}

const POOR_CONDITIONS: Condition[] = [
  "Poor",
  "Bad",
  "Defective",
  "Out of service",
  "Beyond Repair",
];
const CRITICAL_STATUSES: AssetStatus[] = ["Lost", "Missing", "Damaged"];

/** 0–100 health score derived from register data (no live telemetry). */
export function deviceHealth(asset: Asset, now = Date.now()): HealthResult {
  let score = 100;
  const reasons: string[] = [];
  const warranty = parseDate(asset.warrantyExpiry);
  if (warranty !== null && warranty < now) {
    score -= 20;
    reasons.push("warranty-expired");
  } else if (warranty !== null && warranty - now < 60 * DAY) {
    score -= 8;
    reasons.push("warranty-expiring");
  }
  if (POOR_CONDITIONS.includes(asset.condition)) {
    score -= 35;
    reasons.push("poor-condition");
  } else if (asset.condition === "Fair") {
    score -= 12;
    reasons.push("fair-condition");
  }
  if (asset.maintenanceRequired) {
    score -= 15;
    reasons.push("maintenance-due");
  }
  const lifeEnd = parseDate(asset.usefulLifeEnd);
  if (lifeEnd !== null && lifeEnd < now) {
    score -= 15;
    reasons.push("end-of-life");
  }
  if (asset.status === "Under Repair" || asset.status === "Under Maintenance") {
    score -= 10;
    reasons.push("in-service");
  }
  if (CRITICAL_STATUSES.includes(asset.status)) {
    score -= 50;
    reasons.push("critical-status");
  }
  score = Math.max(0, Math.min(100, score));
  const level: HealthLevel =
    score >= 80 ? "healthy" : score >= 50 ? "attention" : "critical";
  return { score, level, reasons };
}

export interface CommandRequest {
  type: DeviceCommandType;
  reason: string;
  targets: { assetId: string; assetCode: string }[];
}

/** Returns an error key, or null when the request may be queued. */
export function validateCommandRequest(
  request: CommandRequest,
): "no-targets" | "too-many" | "reason-required" | "bad-type" | null {
  if (!DEVICE_COMMAND_TYPES.includes(request.type)) return "bad-type";
  if (!request.targets.length) return "no-targets";
  if (request.targets.length > MAX_BULK_TARGETS) return "too-many";
  if (
    SENSITIVE_COMMANDS.includes(request.type) &&
    request.reason.trim().length < MIN_REASON_LENGTH
  )
    return "reason-required";
  return null;
}

export function normalizePolicyRules(
  rules: Partial<DevicePolicyRules>,
): DevicePolicyRules {
  const age = rules.maxAgeYears;
  return {
    requireValidWarranty: rules.requireValidWarranty ?? true,
    requireAssignee: rules.requireAssignee ?? false,
    maxAgeYears:
      typeof age === "number" && Number.isFinite(age) && age > 0
        ? Math.min(age, 50)
        : null,
    allowedConditions: Array.isArray(rules.allowedConditions)
      ? rules.allowedConditions
      : [],
    blockedStatuses: Array.isArray(rules.blockedStatuses)
      ? rules.blockedStatuses
      : [],
  };
}
