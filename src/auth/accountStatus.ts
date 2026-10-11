/**
 * Account state vs. presence.
 *
 * Account state says whether an account may use AIMS at all:
 *   active · disabled · pending_verification
 * Presence says whether the person has a live session right now:
 *   online · offline
 * They are independent (Active + Offline is normal; Disabled is never Online),
 * so the Users module shows them as two separate badges.
 */
import { isEffectivelyOnline, type PresenceRecord } from "../lib/presence";

export const ACCOUNT_STATUSES = ["active", "disabled", "pending_verification"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function normalizeAccountStatus(value: unknown): AccountStatus {
  return (ACCOUNT_STATUSES as readonly unknown[]).includes(value)
    ? (value as AccountStatus)
    : "active";
}

/**
 * Directory status is written by the server at sign-in time. An administrator
 * can suspend an account later through its access assignment, so the Users
 * module overlays that on top: a suspension always wins.
 */
export function resolveAccountStatus(
  directoryStatus: unknown,
  assignmentActive: boolean | undefined,
): AccountStatus {
  if (assignmentActive === false) return "disabled";
  return normalizeAccountStatus(directoryStatus);
}

/** Only an active account can be Online; disabled / unverified accounts are shown Offline. */
export function resolvePresence(
  status: AccountStatus,
  record: PresenceRecord | undefined,
  now: number,
): boolean {
  return status === "active" && isEffectivelyOnline(record, now);
}

export function accountStatusLabel(status: AccountStatus, language: "en" | "nl"): string {
  const nl = language === "nl";
  switch (status) {
    case "disabled":
      return nl ? "Uitgeschakeld" : "Disabled";
    case "pending_verification":
      return nl ? "Verificatie in afwachting" : "Pending verification";
    default:
      return nl ? "Actief" : "Active";
  }
}

export function accountStatusTone(status: AccountStatus): "success" | "danger" | "warning" {
  return status === "disabled" ? "danger" : status === "pending_verification" ? "warning" : "success";
}
