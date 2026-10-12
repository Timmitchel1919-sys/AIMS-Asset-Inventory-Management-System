import { TrackingTypesPanel } from "../components/TrackingTypesPanel";
import { DataPageLayout } from "../components/data-list/ListInfrastructure";
import { PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";

export function TrackingTypesPage() {
  const { language } = useApp();
  const nl = language === "nl";
  return (
    <DataPageLayout
      header={
        <PageHeader
          title={nl ? "Beheertypen" : "Tracking types"}
          description={
            nl
              ? "Bepaal hoe assets worden bijgehouden: per stuk, gezamenlijk of als verbruiksmateriaal."
              : "Decide how assets are tracked: per item, collectively or as consumables."
          }
        />
      }
    >
      <TrackingTypesPanel />
    </DataPageLayout>
  );
}
