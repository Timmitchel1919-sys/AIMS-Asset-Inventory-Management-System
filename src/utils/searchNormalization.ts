/**
 * AIMS search normalization — the single engine behind Global Search and
 * every module-level search field.
 *
 * Normalization is a derived, search-only representation. Canonical stored
 * values (inventory codes, serial numbers, names, e-mail addresses, MAC
 * addresses …) are never rewritten; they are displayed exactly as stored.
 *
 * Matching is:
 *  - case-insensitive                 (KCSMD-0045 = kcsmd-0045)
 *  - accent/diacritic-insensitive      (José Pérez = jose perez)
 *  - punctuation/space-insensitive     (KCSMD-0045 = KCSMD 0045 = KCSMD_0045
 *                                       = KCSMD/0045 = KCSMD.0045 = KCSMD0045)
 *  - partial-match friendly            (md0045, 0045, smith, kangoeroe)
 */

const COMBINING_MARKS = /\p{M}/gu;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]/gu;
const NON_ALPHANUMERIC_RUN = /[^\p{L}\p{N}]+/gu;

function baseForm(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLocaleLowerCase();
}

/**
 * Canonical compact searchable form.
 *
 * "KCSMD-0045" -> "kcsmd0045" · "Shaquil A. Smith" -> "shaquilasmith"
 * "José Pérez" -> "joseperez" · "AA:BB:CC:11:22:33" -> "aabbcc112233"
 */
export function normalizeSearchValue(value: unknown): string {
  return baseForm(value).replace(NON_ALPHANUMERIC, "");
}

/** Word tokens: "Shaquil A. Smith" -> ["shaquil", "a", "smith"]. */
export function normalizeSearchTokens(value: unknown): string[] {
  return baseForm(value)
    .replace(NON_ALPHANUMERIC_RUN, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export interface SearchIndex {
  compact: string;
  tokens: string[];
  /** Compact form without single-letter tokens (initials), per field:
   *  "Shaquil A. Smith" -> "shaquilsmith". */
  loose: string[];
}

function flatten(values: readonly unknown[]): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === "object")
      Object.values(value as Record<string, unknown>).forEach(visit);
    else out.push(String(value));
  };
  values.forEach(visit);
  return out;
}

export function buildSearchIndex(values: readonly unknown[]): SearchIndex {
  const parts = flatten(values);
  const text = parts.join(" ");
  return {
    compact: normalizeSearchValue(text),
    tokens: normalizeSearchTokens(text),
    loose: parts
      .map((part) => normalizeSearchTokens(part).filter((token) => token.length > 1).join(""))
      .filter(Boolean),
  };
}

export interface PreparedSearchQuery {
  compact: string;
  tokens: string[];
}

/** Normalize a query once, then test it against many records. */
export function prepareSearchQuery(query: unknown): PreparedSearchQuery {
  return {
    compact: normalizeSearchValue(query),
    tokens: normalizeSearchTokens(query),
  };
}

export function matchesSearchIndex(
  query: PreparedSearchQuery,
  index: SearchIndex,
): boolean {
  if (!query.compact) return true;
  // Compact match: KCSMD-0045 <-> kcsmd0045, md0045, 0045;
  // Shaquil A. Smith <-> shaquilasmith; e-mail <-> "shaquil smith kangoeroeschool com".
  if (index.compact.includes(query.compact)) return true;
  // Same, ignoring initials: "shaquilsmith" <-> "Shaquil A. Smith".
  if (index.loose.some((field) => field.includes(query.compact))) return true;
  // Token match for natural phrases: "Shaquil Smith" -> "Shaquil A. Smith",
  // "school onderbouw" -> "Kangoeroe School Onderbouw".
  return (
    query.tokens.length > 0 &&
    query.tokens.every((queryToken) =>
      index.tokens.some((recordToken) => recordToken.includes(queryToken)),
    )
  );
}

/** The one matcher used across AIMS. An empty query matches everything. */
export function matchesSearch(query: unknown, values: readonly unknown[]): boolean {
  const prepared = prepareSearchQuery(query);
  if (!prepared.compact) return true;
  return matchesSearchIndex(prepared, buildSearchIndex(values));
}

/**
 * Locate a query inside a display value for highlighting, ignoring case,
 * accents and punctuation. Returns [start, end) in the ORIGINAL string, or
 * null when the query does not occur as one contiguous compact run.
 */
export function findSearchMatchRange(
  value: string,
  query: unknown,
): [number, number] | null {
  const needle = normalizeSearchValue(query);
  if (!needle) return null;
  let compact = "";
  const origin: number[] = [];
  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index)!;
    const char = String.fromCodePoint(codePoint);
    const normalized = normalizeSearchValue(char);
    for (const piece of normalized) {
      compact += piece;
      origin.push(index);
    }
    index += char.length;
  }
  const start = compact.indexOf(needle);
  if (start < 0) return null;
  const lastOrigin = origin[start + needle.length - 1];
  const lastChar = String.fromCodePoint(value.codePointAt(lastOrigin)!);
  return [origin[start], lastOrigin + lastChar.length];
}

type AssetLike = {
  code?: string;
  previousCodes?: readonly string[];
  name?: string;
  type?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  barcode?: string;
  status?: string;
  condition?: string;
  assignedTo?: string;
  responsibleEmployee?: string;
  department?: string;
  location?: string;
  macAddress?: string;
  hostname?: string;
  ipAddress?: string;
};

/** Searchable values of an ICT asset (fields that do not exist are skipped). */
export function assetSearchValues(asset: AssetLike, extra: readonly unknown[] = []): unknown[] {
  return [
    asset.code,
    asset.previousCodes,
    asset.name,
    asset.type,
    asset.category,
    asset.subcategory,
    asset.brand,
    asset.model,
    asset.serialNumber,
    asset.barcode,
    asset.status,
    asset.condition,
    asset.assignedTo,
    asset.responsibleEmployee,
    asset.department,
    asset.location,
    asset.macAddress,
    asset.hostname,
    asset.ipAddress,
    ...extra,
  ];
}

type UserLike = {
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  displayName?: string;
  initials?: string;
  email?: string;
  employeeId?: string;
  department?: string;
  jobTitle?: string;
  role?: string;
  status?: string;
};

/** Searchable values of a user record. */
export function userSearchValues(user: UserLike): unknown[] {
  return [
    user.name,
    user.firstName,
    user.middleName,
    user.lastName,
    user.displayName,
    user.initials,
    user.email,
    user.employeeId,
    user.department,
    user.jobTitle,
    user.role,
    user.status,
  ];
}

export function createAssetSearchIndex(asset: AssetLike): SearchIndex {
  return buildSearchIndex(assetSearchValues(asset));
}

export function createUserSearchIndex(user: UserLike): SearchIndex {
  return buildSearchIndex(userSearchValues(user));
}
