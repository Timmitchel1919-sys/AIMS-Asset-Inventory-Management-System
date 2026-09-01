/**
 * Phase 7 — which workflow actions cannot run offline.
 *
 * Offline, mutations are persisted as a queued (non-transactional) Firestore
 * batch that replays on reconnect with last-write-wins. That is safe for edits
 * to existing records, but NOT for actions that need the server to allocate an
 * id / code / sequence number, hold a uniqueness lock, guard a shared counter,
 * hard-delete, or run the import pipeline. Those are refused while offline; the
 * user can still read, search and edit existing records.
 */
export function isConnectionRequiredAction(action: string): boolean {
  if (!action) return false;
  return (
    action.endsWith(".create") || // id + (for assets) code/number allocation
    action.endsWith(".delete") || // hard delete + dependency guards
    action.startsWith("stock.") || // guarded onHand / reserved counters
    action.includes("legacy") ||
    action.includes("import") ||
    action === "audit.generate" || // bulk id allocation
    action === "asset.move" || // allocates a transaction id; must be atomic
    action === "asset.return" ||
    action === "bulk.move"
  );
}

export const OFFLINE_BLOCKED_MESSAGE_EN =
  "You're offline. Viewing, searching and editing existing records still works, but this action needs a connection — it will be available again when you reconnect.";
export const OFFLINE_BLOCKED_MESSAGE_NL =
  "U bent offline. Bekijken, zoeken en bestaande records bewerken werkt nog, maar deze actie vereist een verbinding — die is weer beschikbaar zodra u opnieuw verbonden bent.";
