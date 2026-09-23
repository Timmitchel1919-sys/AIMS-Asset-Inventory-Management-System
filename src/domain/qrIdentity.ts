import type { Asset, QrIdentity } from "./types";

export const QR_TOKEN_BYTES = 18;
export const QR_TOKEN_LENGTH = 24;
export const QR_RESOLVER_PREFIX = "/q/" as const;
export const QR_DEFAULT_ORIGIN = "https://aims-asset-inventory-system.web.app" as const;

const TOKEN_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
export const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function base64UrlEncode(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const buffer = (first << 16) | (second << 8) | third;
    output += TOKEN_CHARSET[(buffer >> 18) & 63];
    output += TOKEN_CHARSET[(buffer >> 12) & 63];
    if (index + 1 < bytes.length) output += TOKEN_CHARSET[(buffer >> 6) & 63];
    if (index + 2 < bytes.length) output += TOKEN_CHARSET[buffer & 63];
  }
  return output;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Cryptographically strong, non-sequential, opaque QR identity token.
 * Never derived from the inventory code, serial number, asset ID or any PII.
 */
export function generateQrToken(): string {
  return base64UrlEncode(randomBytes(QR_TOKEN_BYTES));
}

export function isValidQrToken(value: string): boolean {
  return (
    value.length >= 16 &&
    value.length <= 64 &&
    QR_TOKEN_PATTERN.test(value) &&
    value === value.trim()
  );
}

export const hasQrToken = (asset: Pick<Asset, "qrToken"> | null | undefined) =>
  Boolean(asset?.qrToken && isValidQrToken(asset.qrToken));

export function qrResolverPath(token: string) {
  return `${QR_RESOLVER_PREFIX}${encodeURIComponent(token)}`;
}

export function qrResolverUrl(token: string, origin: string = QR_DEFAULT_ORIGIN) {
  return `${origin.replace(/\/$/, "")}${qrResolverPath(token)}`;
}

export function qrResolverPayload(
  asset: Pick<Asset, "qrToken"> | null | undefined,
  origin: string = QR_DEFAULT_ORIGIN,
) {
  return hasQrToken(asset) ? qrResolverUrl(asset!.qrToken as string, origin) : "";
}

/** Extracts a QR identity token from a resolver URL or a raw token value. */
export function qrTokenFromValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isValidQrToken(trimmed)) return trimmed;
  try {
    const url = new URL(
      trimmed,
      typeof window === "undefined" ? QR_DEFAULT_ORIGIN : window.location.origin,
    );
    const match = url.pathname.match(/^\/q\/([^/?#]+)\/?$/i);
    if (match) {
      const token = decodeURIComponent(match[1]);
      return isValidQrToken(token) ? token : null;
    }
  } catch {
    return null;
  }
  return null;
}

export const assetQrPreserved = (
  asset: Pick<Asset, "id" | "qrToken">,
  identities: QrIdentity[],
) =>
  hasQrToken(asset) &&
  identities.some(
    (identity) =>
      identity.id === asset.qrToken &&
      identity.status === "ACTIVE" &&
      identity.assetId === asset.id,
  );

export interface QrBackfillConflict {
  assetId: string;
  code: string;
  reason: string;
}

export interface QrBackfillAssessment {
  totalAssets: number;
  /** Assets that already carry a valid active QR identity. */
  preserve: string[];
  /** Assets that need a QR identity minted (or an orphaned token repaired). */
  create: string[];
  blocked: QrBackfillConflict[];
  invalidQrRecords: number;
  duplicateQrConflicts: number;
  duplicateCodeConflicts: string[];
}

function duplicateTokenHolders(
  assets: Pick<Asset, "id" | "qrToken">[],
): Map<string, string> {
  const used = new Map<string, string>();
  for (const asset of assets) {
    if (!asset.qrToken) continue;
    const previous = used.get(asset.qrToken);
    if (previous !== undefined) {
      if (previous !== "DUPLICATE") used.set(asset.qrToken, "DUPLICATE");
    } else {
      used.set(asset.qrToken, asset.id);
    }
  }
  return used;
}

/**
 * Pure preflight planner for the existing-asset QR backfill. It NEVER mutates
 * data; it returns a decision per asset so callers can run a dry run and a
 * bounded, idempotent apply pass over the same assessment.
 */
export function planQrBackfill(
  assets: Pick<Asset, "id" | "code" | "qrToken">[],
  identities: QrIdentity[],
): QrBackfillAssessment {
  const identitiesById = new Map(identities.map((identity) => [identity.id, identity]));
  const tokenHolders = duplicateTokenHolders(assets);

  const codeGroups = new Map<string, string[]>();
  for (const asset of assets) {
    const group = codeGroups.get(asset.code) || [];
    group.push(asset.id);
    codeGroups.set(asset.code, group);
  }
  const duplicateCodeConflicts = [...codeGroups]
    .filter(([, members]) => members.length > 1)
    .map(([code]) => code);

  const blocked: QrBackfillConflict[] = [];
  const preserve: string[] = [];
  const create: string[] = [];
  let invalidQrRecords = 0;

  for (const asset of assets) {
    const dupCode = (codeGroups.get(asset.code) || []).length > 1;
    const dupToken = asset.qrToken
      ? tokenHolders.get(asset.qrToken) === "DUPLICATE"
      : false;
    if (dupCode || dupToken) {
      blocked.push({
        assetId: asset.id,
        code: asset.code,
        reason: dupCode
          ? "Duplicate inventory code requires controlled resolution."
          : "The QR identity token is already bound to another asset.",
      });
      continue;
    }
    if (asset.qrToken && !isValidQrToken(asset.qrToken)) {
      invalidQrRecords += 1;
      create.push(asset.id);
      continue;
    }
    const identity = asset.qrToken ? identitiesById.get(asset.qrToken) : undefined;
    if (identity && identity.assetId !== asset.id) {
      blocked.push({
        assetId: asset.id,
        code: asset.code,
        reason: "The QR identity token is already bound to another asset.",
      });
      continue;
    }
    if (identity && identity.status === "ACTIVE") {
      preserve.push(asset.id);
      continue;
    }
    if (identity && identity.status !== "ACTIVE") {
      invalidQrRecords += 1;
      create.push(asset.id);
      continue;
    }
    create.push(asset.id);
  }

  return {
    totalAssets: assets.length,
    preserve,
    create,
    blocked,
    invalidQrRecords,
    duplicateQrConflicts: [...tokenHolders.values()].filter(
      (value) => value === "DUPLICATE",
    ).length,
    duplicateCodeConflicts,
  };
}