/**
 * Phase 7 — a single source of truth for the app's connectivity state:
 *   online   — connected, in sync
 *   syncing  — connected, flushing queued offline writes
 *   degraded — nominally online but the server is unreachable / a write failed
 *   offline  — no connection; reads come from the local cache
 */
import { doc, onSnapshot } from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { firestore } from "./firebase";

export type Connectivity = "online" | "syncing" | "degraded" | "offline";

export type ConnectivitySignals = {
  navOnline: boolean;
  hasPendingWrites: boolean;
  serverUnreachable: boolean;
  writeError: boolean;
};

export function deriveConnectivity(s: ConnectivitySignals): Connectivity {
  if (!s.navOnline) return "offline";
  if (s.hasPendingWrites) return "syncing";
  if (s.serverUnreachable || s.writeError) return "degraded";
  return "online";
}

const signals: ConnectivitySignals = {
  navOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  hasPendingWrites: false,
  serverUnreachable: false,
  writeError: false,
};

let current: Connectivity = deriveConnectivity(signals);
const listeners = new Set<() => void>();

function recompute() {
  const next = deriveConnectivity(signals);
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

/** The repository calls this when a queued/online write fails or later succeeds. */
export function reportWriteError(failed: boolean) {
  signals.writeError = failed;
  recompute();
}

// Firestore error codes that indicate the service itself is unreachable or
// struggling — the only cases that should ever turn the badge "Limited".
// Codes like permission-denied, not-found or failed-precondition are the
// server correctly answering a request; they prove connectivity is fine and
// must never be reported as a connectivity problem.
const CONNECTIVITY_ERROR_CODES = new Set([
  "unavailable",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unknown",
  "cancelled",
  "aborted",
]);

/** Whether a caught error reflects real service unreachability, as opposed
 * to an expected rejection (authorization, validation, conflict) from a
 * server that is clearly reachable and responding. */
export function isConnectivityError(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code || "").replace(
    "firestore/",
    "",
  );
  if (code) return CONNECTIVITY_ERROR_CODES.has(code);
  // A plain Error with no Firestore error code (e.g. a thrown business-rule
  // message such as "This code group already exists.") is an application
  // decision, not a connectivity failure.
  return false;
}

const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => current,
};

export function getConnectivity() {
  return current;
}

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(store.subscribe, store.get, () => "online");
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    signals.navOnline = true;
    recompute();
  });
  window.addEventListener("offline", () => {
    signals.navOnline = false;
    signals.hasPendingWrites = false;
    recompute();
  });

  if (firestore) {
    // One cheap metadata listener tells us both whether writes are still
    // pending (syncing) and whether reads are only coming from cache while we
    // think we are online (degraded).
    let settled = false;
    onSnapshot(
      doc(firestore, "systemSettings", "organization"),
      { includeMetadataChanges: true },
      (snap) => {
        signals.hasPendingWrites = snap.metadata.hasPendingWrites;
        // Ignore the very first cache hit on cold load; only treat sustained
        // cache-only reads as "server unreachable".
        signals.serverUnreachable =
          settled && signals.navOnline && snap.metadata.fromCache;
        settled = true;
        recompute();
      },
      () => {
        /* listener errors are non-fatal for connectivity purposes */
      },
    );
  }
}
