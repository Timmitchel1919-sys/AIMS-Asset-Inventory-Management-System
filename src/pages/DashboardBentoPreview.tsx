import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useMockSnapshot } from "../data/repositoryContext";
import { BentoShell } from "../components/dashboard/bento/BentoShell";
import { HeroTile } from "../components/dashboard/bento/tiles/HeroTile";
import { CategoryAllocationTile } from "../components/dashboard/bento/tiles/CategoryAllocationTile";
import { RecentActivityTile } from "../components/dashboard/bento/tiles/RecentActivityTile";
import { PlaceholderTile } from "../components/dashboard/bento/tiles/PlaceholderTile";

export default function DashboardBentoPreview() {
  const { user, language, effectiveTheme, formatDateTime, setTheme } = useApp();
  const snapshot = useMockSnapshot();
  const nl = language === "nl";

  const isProd = !import.meta.env.DEV;
  const onDark = effectiveTheme === "dark";

  const assets = useMemo(() => snapshot.assets, [snapshot.assets]);
  const movements = useMemo(() => snapshot.movements, [snapshot.movements]);

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
        <HeroTile
          nl={nl}
          userName={user?.name}
          assets={assets}
          movements={movements}
        />
        <PlaceholderTile
          title={nl ? "Afdelingskaarten" : "Department cards"}
          detail={
            nl
              ? "Beschikbaar in Phase 2. Vereist bevestigde afdelingsmapping."
              : "Available in Phase 2. Requires confirmed department mapping."
          }
          previewLabel={nl ? "Later" : "Later"}
        />
        <PlaceholderTile
          title={nl ? "Benutting" : "Utilization"}
          detail={
            nl
              ? "Beschikbaar in Phase 2 na bevestiging van statusdefinities."
              : "Available in Phase 2 after status-definition sign-off."
          }
          previewLabel={nl ? "Later" : "Later"}
        />
        <PlaceholderTile
          title={nl ? "Levenscyclus / Afschrijving" : "Lifecycle / Depreciation"}
          detail={
            nl
              ? "Afgerond na audit van financiële velden."
              : "Pending audit of financial fields."
          }
          previewLabel={nl ? "Later" : "Later"}
          span={2}
        />
        <CategoryAllocationTile nl={nl} assets={assets} />
        <PlaceholderTile
          title={nl ? "Onderhoud" : "Maintenance intelligence"}
          detail={
            nl
              ? "Volgt zodra operationele definities zijn bevestigd."
              : "Follows once operational definitions are confirmed."
          }
          previewLabel={nl ? "Later" : "Later"}
        />
        <PlaceholderTile
          title={nl ? "Voorraaddrempel" : "Stock threshold"}
          detail={
            nl
              ? "Alleen voor voorraaditems met min/herbestel/max."
              : "Only for inventory items with min/reorder/max set."
          }
          previewLabel={nl ? "Later" : "Later"}
        />
        <PlaceholderTile
          title={nl ? "Bewegingsstream" : "Movement stream"}
          detail={
            nl
              ? "Live-polling ontwerp volgt in Phase 2."
              : "Live-polling design to follow in Phase 2."
          }
          previewLabel={nl ? "Later" : "Later"}
          span={2}
        />
        <RecentActivityTile
          nl={nl}
          movements={movements}
          formatDateTime={formatDateTime}
        />
      </BentoShell>
    </div>
  );
}
