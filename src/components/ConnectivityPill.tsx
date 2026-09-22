import { Check, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import {
  useConnectionStatus,
  type ConnectionStatus,
} from "../hooks/useConnectionStatus";
import { useApp } from "../context/AppContext";

const LABEL: Record<ConnectionStatus, [string, string]> = {
  online: ["Online", "Online"],
  syncing: ["Syncing…", "Synchroniseren…"],
  limited: ["Limited", "Beperkt"],
  offline: ["Offline", "Offline"],
};
const TITLE: Record<ConnectionStatus, [string, string]> = {
  online: ["Connected and in sync.", "Verbonden en gesynchroniseerd."],
  syncing: [
    "Connected — sending changes made offline.",
    "Verbonden — offline gemaakte wijzigingen worden verzonden.",
  ],
  limited: [
    "The server is hard to reach. You are seeing cached data; changes may be delayed.",
    "De server is moeilijk bereikbaar. U ziet gecachte gegevens; wijzigingen kunnen vertraagd zijn.",
  ],
  offline: [
    "No connection. You can view, search and edit existing records; adding new records and stock moves resume when you reconnect.",
    "Geen verbinding. U kunt bestaande records bekijken, zoeken en bewerken; nieuwe records en voorraadmutaties hervatten bij herverbinding.",
  ],
};

const ICON: Record<ConnectionStatus, typeof Check> = {
  online: Check,
  syncing: RefreshCw,
  limited: TriangleAlert,
  offline: CloudOff,
};

export function ConnectivityPill() {
  const state = useConnectionStatus();
  const nl = useApp().language === "nl";
  const Icon = ICON[state];
  const label = LABEL[state][nl ? 1 : 0];
  return (
    <span
      className={`connectivity-pill connectivity-pill--${state}`}
      role="status"
      aria-live="polite"
      aria-label={
        state === "syncing"
          ? nl
            ? "AIMS synchronisatie bezig"
            : "AIMS synchronization in progress"
          : nl
            ? `AIMS verbindingsstatus: ${label}`
            : `AIMS connection status: ${label}`
      }
      title={TITLE[state][nl ? 1 : 0]}
    >
      <Icon
        size={14}
        aria-hidden="true"
        className={state === "syncing" ? "spin" : undefined}
      />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
