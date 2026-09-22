/**
 * Public connection-status API for AIMS. This is a thin, renamed view over
 * the real implementation in `src/lib/connectivity.ts` — the single source
 * of truth that already owns the `online`/`offline` listeners and the one
 * Firestore metadata listener used to detect degraded service. There is
 * deliberately no second Firebase listener or polling loop here: adding one
 * would duplicate reads and could disagree with the header badge.
 *
 * Use this hook (or `connectionStatus`/`useConnectivity` from
 * `../lib/connectivity` directly, they are equivalent) anywhere a component
 * needs to react to connectivity.
 */
import { useConnectivity, type Connectivity } from "../lib/connectivity";

export type ConnectionStatus = "online" | "limited" | "offline" | "syncing";

const TO_CONNECTION_STATUS: Record<Connectivity, ConnectionStatus> = {
  online: "online",
  syncing: "syncing",
  degraded: "limited",
  offline: "offline",
};

export function useConnectionStatus(): ConnectionStatus {
  return TO_CONNECTION_STATUS[useConnectivity()];
}
