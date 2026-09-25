/**
 * Technical specifications are stored as a flat string map. Lines written as
 * `Key: value` become their own entry; every other line is free text and is
 * kept verbatim under `rawSpecifications` (the key the legacy import already
 * uses for the original specification text).
 */
export const RAW_SPECIFICATIONS_KEY = "rawSpecifications";

const MAX_KEY_LENGTH = 60;

function keyValue(line: string): [string, string] | null {
  const index = line.indexOf(":");
  if (index <= 0) return null;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();
  // A bare URL ("https://...") or a heading ending in ":" is free text.
  if (!key || !value || key.length > MAX_KEY_LENGTH || value.startsWith("//"))
    return null;
  if (key === RAW_SPECIFICATIONS_KEY) return null;
  return [key, value];
}

export function parseTechnicalSpecifications(text: string) {
  const result: Record<string, string> = {};
  const freeText: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const pair = keyValue(line);
    if (pair) result[pair[0]] = pair[1];
    else freeText.push(line);
  }
  if (freeText.length) result[RAW_SPECIFICATIONS_KEY] = freeText.join("\n");
  return result;
}

export function formatTechnicalSpecifications(
  specifications: Record<string, string> | undefined,
) {
  const entries = Object.entries(specifications || {});
  const raw = entries.find(([key]) => key === RAW_SPECIFICATIONS_KEY)?.[1];
  const lines = raw ? [raw] : [];
  for (const [key, value] of entries) {
    if (key === RAW_SPECIFICATIONS_KEY) continue;
    // Older free-text saves stored the line as a key with an empty value.
    lines.push(String(value ?? "").trim() ? `${key}: ${value}` : key);
  }
  return lines.join("\n");
}
