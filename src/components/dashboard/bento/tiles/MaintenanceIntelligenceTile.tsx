import { useMemo } from "react";
import type { Maintenance } from "../../../../domain/types";
import { computeMaintenanceKpis } from "./maintenanceKpis";

interface Props {
  nl: boolean;
  maintenance: Maintenance[];
  now?: Date;
}

export function MaintenanceIntelligenceTile({ nl, maintenance, now }: Props) {
  const kpis = useMemo(
    () => computeMaintenanceKpis(maintenance, now ?? new Date()),
    [maintenance, now],
  );
  const maxDay = Math.max(1, ...kpis.schedule.map((s) => s.count));
  const dayShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(nl ? "nl-NL" : "en-US", { weekday: "short" });
  };

  return (
    <section className="bento-tile bento-maint" aria-labelledby="bento-maint-title">
      <header className="bento-tile__header">
        <h3 id="bento-maint-title" className="bento-tile__title">
          {nl ? "Onderhoud" : "Maintenance intelligence"}
        </h3>
        <span className="bento-tile__chip">
          {kpis.open.toLocaleString()} {nl ? "open" : "open"}
        </span>
      </header>

      {maintenance.length === 0 ? (
        <p className="bento-empty">
          {nl
            ? "Geen onderhoudstaken geregistreerd."
            : "No maintenance records available."}
        </p>
      ) : kpis.open === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen open onderhoudstaken." : "No open maintenance tasks."}
        </p>
      ) : (
        <>
          <dl className="bento-maint__kpis">
            <div>
              <dt>{nl ? "Open" : "Open"}</dt>
              <dd>{kpis.open.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Binnen 7 dagen" : "Due in 7 days"}</dt>
              <dd>{kpis.dueSoon.toLocaleString()}</dd>
            </div>
            <div
              className={
                kpis.overdue > 0 ? "bento-maint__kpi--warn" : undefined
              }
            >
              <dt>{nl ? "Achterstallig" : "Overdue"}</dt>
              <dd>{kpis.overdue.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "In uitvoering" : "In progress"}</dt>
              <dd>{kpis.inProgress.toLocaleString()}</dd>
            </div>
          </dl>

          <div
            className="bento-maint__schedule"
            role="img"
            aria-label={
              nl
                ? "Komende 7 dagen onderhoudsplanning"
                : "Upcoming 7-day maintenance schedule"
            }
          >
            <ol>
              {kpis.schedule.map((s) => (
                <li key={s.date} title={`${s.date}: ${s.count}`}>
                  <span
                    className="bento-maint__bar"
                    style={{
                      height:
                        s.count === 0
                          ? "6%"
                          : `${8 + (s.count / maxDay) * 92}%`,
                      opacity: s.count === 0 ? 0.25 : 1,
                    }}
                    aria-hidden="true"
                  />
                  <span className="bento-maint__dow">{dayShort(s.date)}</span>
                </li>
              ))}
            </ol>
            {kpis.dueSoon === 0 && (
              <p className="bento-maint__quiet">
                {nl
                  ? "Geen gepland werk deze week."
                  : "No scheduled work this week."}
              </p>
            )}
          </div>

          {kpis.invalidDates > 0 && (
            <p className="bento-maint__note">
              {nl
                ? `${kpis.invalidDates} open taak zonder geldige datum.`
                : `${kpis.invalidDates} open task(s) without a valid date.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MaintenanceIntelligenceTile;
