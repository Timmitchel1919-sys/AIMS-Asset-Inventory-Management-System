import type { Asset } from "./types";
import { qrTokenFromValue } from "./qrIdentity";

function assetReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(
      trimmed,
      typeof window === "undefined"
        ? "https://inventory.kcs.local"
        : window.location.origin,
    );
    const match = url.pathname.match(/^\/assets\/([^/?#]+)\/?$/i);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    /* A plain asset ID or KCS code is also valid input. */
  }
  return trimmed;
}

/**
 * Resolution order matters: a QR identity token (raw or inside a `/q/<token>`
 * resolver URL) always wins over human-readable references, because a printed
 * QR must never be re-interpreted as an asset code, serial number or PII.
 * A valid token that matches no active asset resolves to `undefined`.
 */
export function resolveScannedAsset(value: string, assets: Asset[]) {
  const token = qrTokenFromValue(value);
  if (token)
    return assets.find((asset) => asset.qrToken === token);
  const reference = assetReference(value).toLowerCase();
  return assets.find(
    (asset) =>
      asset.id.toLowerCase() === reference ||
      asset.code.toLowerCase() === reference ||
      asset.barcode?.toLowerCase() === reference,
  );
}
