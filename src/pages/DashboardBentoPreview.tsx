import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useMockSnapshot } from "../data/repositoryContext";
import { BentoShell } from "../components/dashboard/bento/BentoShell";
import { HeroTile } from "../components/dashboard/bento/tiles/HeroTile";
import { CategoryAllocationTile } from "../components/dashboard/bento/tiles/CategoryAllocationTile";
import { RecentActivityTile } from "../components/dashboard/bento/tiles/RecentActivityTile";
import { DepartmentCardsTile } from "../components/dashboard/bento/tiles/DepartmentCardsTile";
import { LocationCardsTile } from "../components/dashboard/bento/tiles/LocationCardsTile";
import { UtilizationGaugeTile } from "../components/dashboard/bento/tiles/UtilizationGaugeTile";
import { MaintenanceIntelligenceTile } from "../components/dashboard/bento/tiles/MaintenanceIntelligenceTile";
import { MovementStreamTile } from "../components/dashboard/bento/tiles/MovementStreamTile";
import { StockThresholdTile } from "../components/dashboard/bento/tiles/StockThresholdTile";
import { AssetAgeTile } from "../components/dashboard/bento/tiles/AssetAgeTile";

export default function DashboardBentoPreview() {
  const { user, language, effectiveTheme, formatDateTime, setTheme } = useApp();
  const snapshot = useMockSnapshot();
  const nl = language === "nl";

  const isProd = !import.meta.env.DEV;
  const onDark = effectiveTheme === "dark";

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

  if (isProd) {
    return (
      <div className="page">
        <div className="bento-theme-gate" role="status">
          <h2>{nl ? "Preview niet beschikbaar" : "Preview unavailable"}</h2>
          <p>
            {nl
              ? "Deze Dark Bento preview is alleen beschikbaar in de ontwikkelomgeving."
              : "This Dark Bento preview is only available in the development environment."}
          </p>
        </div>
      </div>
    );
  }

  if (!onDark) {
    return (
      <div className="page">
        <div className="bento-theme-gate" role="status">
          <h2>{nl ? "Schakel naar Midnight / Dark" : "Switch to Midnight / Dark"}</h2>
          <p>
            {nl
              ? "De Dark Bento preview is gereserveerd voor het Midnight / Dark thema zodat je ontwerp consistent blijft."
              : "The Dark Bento preview is reserved for the Midnight / Dark theme to keep the design consistent."}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setTheme("dark")}
          >
            {nl ? "Schakel naar Midnight / Dark" : "Switch to Midnight / Dark"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-title" style={{ marginBottom: 16 }}>
        <h1>
          {nl ? "Dashboard — Dark Bento Preview" : "Dashboard — Dark Bento Preview"}
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
          {nl
            ? "Geïsoleerde preview. Het live dashboard is onveranderd."
            : "Isolated preview. The live dashboard is unchanged."}
        </p>
      </header>

      <BentoShell>
        {/* Row 1 — Hero + Departments + Locations */}
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

        {/* Row 2 — Utilization + Category + Maintenance */}
        <UtilizationGaugeTile nl={nl} assets={assets} />
        <CategoryAllocationTile nl={nl} assets={assets} />
        <MaintenanceIntelligenceTile nl={nl} maintenance={maintenance} />

        {/* Row 3 — Movement Stream (span 2) + Stock Threshold + Asset Age */}
        <MovementStreamTile nl={nl} movements={movements} />
        <StockThresholdTile nl={nl} inventory={inventory} />
        <AssetAgeTile nl={nl} assets={assets} />

        {/* Row 4 — Recent activity full width */}
        <RecentActivityTile
          nl={nl}
          movements={movements}
          formatDateTime={formatDateTime}
        />
      </BentoShell>
    </div>
  );
}
