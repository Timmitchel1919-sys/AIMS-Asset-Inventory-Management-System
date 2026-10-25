import { useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { useMockSnapshot } from "../../../data/repositoryContext";
import { BentoShell } from "./BentoShell";
import { HeroTile } from "./tiles/HeroTile";
import { CategoryAllocationTile } from "./tiles/CategoryAllocationTile";
import { RecentActivityTile } from "./tiles/RecentActivityTile";
import { DepartmentCardsTile } from "./tiles/DepartmentCardsTile";
import { LocationCardsTile } from "./tiles/LocationCardsTile";
import { UtilizationGaugeTile } from "./tiles/UtilizationGaugeTile";
import { MaintenanceIntelligenceTile } from "./tiles/MaintenanceIntelligenceTile";
import { MovementStreamTile } from "./tiles/MovementStreamTile";
import { StockThresholdTile } from "./tiles/StockThresholdTile";
import { AssetAgeTile } from "./tiles/AssetAgeTile";

/**
 * The Dark Bento Dashboard content, suitable for mounting at `/dashboard`
 * when the Midnight / Dark Theme is active. Pure consumer of the shared
 * `useMockSnapshot()` and `useApp()` contexts; no additional Firestore
 * listeners are created, since `useRepositorySnapshot` is built on
 * `useSyncExternalStore` and shares a single subscription across consumers.
 *
 * Carries no preview or theme guards itself. Those remain the caller's
 * responsibility (Dashboard.tsx branches on theme; DashboardBentoPreview
 * continues to guard the dev-only preview route).
 */
export function BentoDashboard() {
  const { user, language, formatDateTime } = useApp();
  const snapshot = useMockSnapshot();
  const nl = language === "nl";

  const assets = useMemo(() => snapshot.assets, [snapshot.assets]);
  const movements = useMemo(() => snapshot.movements, [snapshot.movements]);
  const references = useMemo(() => snapshot.references, [snapshot.references]);
  const locationTypes = useMemo(
    () => snapshot.locationTypes,
    [snapshot.locationTypes],
  );
  const maintenance = useMemo(
    () => snapshot.maintenance,
    [snapshot.maintenance],
  );
  const inventory = useMemo(() => snapshot.inventory, [snapshot.inventory]);

  return (
    <div className="page">
      <BentoShell>
        <HeroTile
          nl={nl}
          userName={user?.name}
          assets={assets}
          movements={movements}
        />
        <DepartmentCardsTile nl={nl} references={references} assets={assets} />
        <LocationCardsTile
          nl={nl}
          references={references}
          locationTypes={locationTypes}
          assets={assets}
        />
        <UtilizationGaugeTile nl={nl} assets={assets} />
        <CategoryAllocationTile nl={nl} assets={assets} />
        <MaintenanceIntelligenceTile nl={nl} maintenance={maintenance} />
        <MovementStreamTile nl={nl} movements={movements} />
        <StockThresholdTile nl={nl} inventory={inventory} />
        <AssetAgeTile nl={nl} assets={assets} />
        <RecentActivityTile
          nl={nl}
          movements={movements}
          formatDateTime={formatDateTime}
        />
      </BentoShell>
    </div>
  );
}

export default BentoDashboard;
