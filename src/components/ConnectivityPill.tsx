import { Check, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useConnectivity, type Connectivity } from "../lib/connectivity";
import { useApp } from "../context/AppContext";

const LABEL: Record<Connectivity, [string, string]> = {
  online: ["Online", "Online"],
  syncing: ["Syncing…", "Synchroniseren…"],
  degraded: ["Limited", "Beperkt"],
  offline: ["Offline", "Offline"],
};
const TITLE: Record<Connectivity, [string, string]> = {
  online: ["Connected and in sync.", "Verbonden en gesynchroniseerd."],
  syncing: [
    "Connected — sending changes made offline.",
    "Verbonden — offline gemaakte wijzigingen worden verzonden.",
  ],
  degraded: [
    "The server is hard to reach. You are seeing cached data; changes may be delayed.",
    "De server is moeilijk bereikbaar. U ziet gecachte gegevens; wijzigingen kunnen vertraagd zijn.",
  ],
  offline: [
    "No connection. You can view, search and edit existing records; adding new records and stock moves resume when you reconnect.",
    "Geen verbinding. U kunt bestaande records bekijken, zoeken en bewerken; nieuwe records en voorraadmutaties hervatten bij herverbinding.",
  ],
};

const ICON: Record<Connectivity, typeof Check> = {
  online: Check,
  syncing: RefreshCw,
  degraded: TriangleAlert,
  offline: CloudOff,
};

export function ConnectivityPill() {
  const state = useConnectivity();
  const nl = useApp().language === "nl";
  if (state === "online") return null; // keep the bar quiet when all is well
  const Icon = ICON[state];
  return (
    <span
      className={`connectivity-pill connectivity-pill--${state}`}
      role="status"
      aria-live="polite"
      title={TITLE[state][nl ? 1 : 0]}
    >
      <Icon
        size={14}
        aria-hidden="true"
        className={state === "syncing" ? "spin" : undefined}
      />
      {LABEL[state][nl ? 1 : 0]}
    </span>
  );
}
