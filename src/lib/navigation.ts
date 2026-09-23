export interface ReturnPathParts {
  pathname?: string;
  search?: string;
  hash?: string;
}

/** Only accept internal single-slash paths; rejects open-redirect vectors. */
export function isSafeInternalPath(path: string) {
  if (!path) return false;
  if (path.includes("://")) return false;
  if (path.startsWith("//")) return false;
  if (!path.startsWith("/")) return false;
  return true;
}

export function safeTargetFromState(
  from?: ReturnPathParts | null,
): string | null {
  if (!from?.pathname || !isSafeInternalPath(from.pathname)) return null;
  const search = from.search && from.search.startsWith("?") ? from.search : "";
  const hash = from.hash && from.hash.startsWith("#") ? from.hash : "";
  return `${from.pathname}${search}${hash}`;
}