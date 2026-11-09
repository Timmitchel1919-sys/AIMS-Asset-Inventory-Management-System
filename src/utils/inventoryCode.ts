export function displayInventoryCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const assetCode = normalized.match(/(?:^|INV-)(KCS[A-Z0-9]*-\d+)/)?.[1];
  return assetCode ?? normalized.replace(/^INV-/, "");
}
