import { useMemo } from "react";
import type { Asset, Movement } from "../../../../domain/types";

interface Props {
  nl: boolean;
  userName?: string;
  assets: Asset[];
  movements: Movement[];
  now?: Date;
}

interface DayBucket {
  d: string;
  count: number;
}

const DAYS = 30;
const INACTIVE_STATUSES = new Set<string>(["Disposed", "Archived"]);
const IN_USE_STATUSES = new Set<string>(["Assigned", "Borrowed"]);

/**
 * Count the number of movement events per day in the last 30 days.
 *
 * Serialized asset movements (issue / return / transfer / maintenance / repair /
 * receive) are status transitions, not stock-balance deltas, so a signed "net"
 * value is not meaningful here. We report the daily *event count* instead.
 */
function bucketLast30Days(movements: Movement[], now: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    buckets.push({ d: d.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.d, i]));
  for (const m of movements) {
    if (!m.date) continue;
    const day = m.date.slice(0, 10);
    const i = index.get(day);
    if (i === undefined) continue;
    buckets[i].count += 1;
  }
  return buckets;
}

export function HeroTile({ nl, userName, assets, movements, now }: Props) {
  const totals = useMemo(() => {
    const active = assets.filter((a) => !INACTIVE_STATUSES.has(a.status));
    const inUse = active.filter((a) => IN_USE_STATUSES.has(a.status));
    const available = active.filter((a) => a.status === "Available");
    return {
      total: active.length,
      inUse: inUse.length,
      available: available.length,
    };
  }, [assets]);

  const buckets = useMemo(
    () => bucketLast30Days(movements, now ?? new Date()),
    [movements, now],
  );

  const totalEvents = useMemo(
    () => buckets.reduce((sum, b) => sum + b.count, 0),
    [buckets],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.count)),
    [buckets],
  );

  const firstLabel = buckets[0]?.d ?? "";
  const lastLabel = buckets[buckets.length - 1]?.d ?? "";

  return (
    <section
      className="bento-tile bento-tile--span-2"
      aria-labelledby="bento-hero-title"
    >
      <div className="bento-hero__row">
        <div>
          <h2 id="bento-hero-title" className="bento-hero__welcome">
            {nl ? "Welkom, " : "Welcome, "}
            <em>{userName ?? "AIMS"}</em>
          </h2>
          <p className="bento-hero__subline">
            {nl
              ? "Overzicht van je actieve inventaris en bewegingen."
              : "Overview of your active inventory and movements."}
          </p>
        </div>
        <div className="bento-hero__kpi" aria-live="polite">
          <p className="bento-hero__kpi-label">
            {nl ? "Totaal middelen" : "Total assets"}
          </p>
          <p className="bento-hero__kpi-value">{totals.total.toLocaleString()}</p>
          <p className="bento-hero__kpi-sub">
            {nl ? "30-daagse activiteit " : "30-day activity "}
            {totalEvents.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bento-hero__minis">
        <div className="bento-hero__mini">
          <p className="bento-hero__mini-label">
            {nl ? "Beschikbaar" : "Available"}
          </p>
          <p className="bento-hero__mini-value">{totals.available.toLocaleString()}</p>
        </div>
        <div className="bento-hero__mini">
          <p className="bento-hero__mini-label">
            {nl ? "In gebruik" : "In use"}
          </p>
          <p className="bento-hero__mini-value">{totals.inUse.toLocaleString()}</p>
        </div>
        <div className="bento-hero__mini">
          <p className="bento-hero__mini-label">
            {nl ? "Gebeurtenissen (30d)" : "Events (30d)"}
          </p>
          <p className="bento-hero__mini-value">{totalEvents.toLocaleString()}</p>
        </div>
      </div>

      {totalEvents === 0 ? (
        <p className="bento-hero__empty" role="status">
          {nl
            ? "Geen middelbewegingen in de laatste 30 dagen."
            : "No asset movements in the last 30 days."}
        </p>
      ) : (
        <>
          <div
            className="bento-hero__strip"
            role="img"
            aria-label={
              nl
                ? `Dagelijkse gebeurtenissen over 30 dagen van ${firstLabel} tot ${lastLabel}`
                : `Daily movement events over 30 days from ${firstLabel} to ${lastLabel}`
            }
          >
            {buckets.map((b) => {
              const h = 6 + (b.count / maxCount) * 94;
              return (
                <span
                  key={b.d}
                  className="bento-hero__strip-bar"
                  style={{ height: `${h}%` }}
                  aria-hidden="true"
                  title={`${b.d}: ${b.count}`}
                />
              );
            })}
          </div>
          <div className="bento-hero__strip-caption" aria-hidden="true">
            <span>{firstLabel}</span>
            <span>{nl ? "Vandaag" : "Today"}</span>
          </div>
        </>
      )}
    </section>
  );
}

export default HeroTile;
