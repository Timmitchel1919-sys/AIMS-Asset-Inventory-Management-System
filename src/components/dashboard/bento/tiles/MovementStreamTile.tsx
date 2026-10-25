import { useMemo } from "react";
import type { Movement } from "../../../../domain/types";
import { computeMovementStream } from "./movementStream";

interface Props {
  nl: boolean;
  movements: Movement[];
  now?: Date;
  formatDate?: (date: string) => string;
}

export function MovementStreamTile({ nl, movements, now, formatDate }: Props) {
  const stream = useMemo(
    () => computeMovementStream(movements, now ?? new Date()),
    [movements, now],
  );

  const maxCount = Math.max(1, ...stream.buckets.map((b) => b.count));
  const firstLabel = stream.buckets[0]?.date ?? "";
  const lastLabel = stream.buckets[stream.buckets.length - 1]?.date ?? "";

  const peakLabel =
    stream.peakDate !== null
      ? formatDate
        ? formatDate(stream.peakDate)
        : stream.peakDate
      : null;

  const mostRecentLabel =
    stream.mostRecent !== null
      ? formatDate
        ? formatDate(stream.mostRecent.toISOString())
        : stream.mostRecent.toISOString().slice(0, 10)
      : null;

  return (
    <section
      className="bento-tile bento-tile--span-2"
      aria-labelledby="bento-stream-title"
    >
      <header className="bento-tile__header">
        <h3 id="bento-stream-title" className="bento-tile__title">
          {nl ? "Bewegingsstream" : "Movement stream"}
        </h3>
        <span className="bento-tile__chip">
          {stream.totalEvents.toLocaleString()}{" "}
          {nl ? "gebeurtenissen · 14d" : "events · 14d"}
        </span>
      </header>

      {movements.length === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen bewegingen beschikbaar." : "No movement records available."}
        </p>
      ) : stream.totalEvents === 0 ? (
        <p className="bento-empty">
          {nl
            ? "Geen bewegingen in de laatste 14 dagen."
            : "No movements in the last 14 days."}
        </p>
      ) : (
        <>
          <div
            className="bento-stream__chart"
            role="img"
            aria-label={
              nl
                ? `Dagelijkse bewegingsgebeurtenissen van ${firstLabel} tot ${lastLabel}, totaal ${stream.totalEvents}`
                : `Daily movement events from ${firstLabel} to ${lastLabel}, total ${stream.totalEvents}`
            }
          >
            {stream.buckets.map((b) => {
              const h = b.count === 0 ? 6 : 8 + (b.count / maxCount) * 92;
              const isPeak = b.date === stream.peakDate && b.count > 0;
              return (
                <span
                  key={b.date}
                  className={
                    "bento-stream__bar" +
                    (isPeak ? " bento-stream__bar--peak" : "")
                  }
                  style={{ height: `${h}%`, opacity: b.count === 0 ? 0.25 : 1 }}
                  aria-hidden="true"
                  title={`${b.date}: ${b.count}`}
                />
              );
            })}
          </div>
          <div className="bento-stream__caption" aria-hidden="true">
            <span>{firstLabel}</span>
            <span>{nl ? "Vandaag" : "Today"}</span>
          </div>

          <dl className="bento-stream__summary">
            <div>
              <dt>{nl ? "Piekdag" : "Peak day"}</dt>
              <dd>
                {peakLabel ?? "—"}
                {stream.peakCount > 0 && (
                  <> · {stream.peakCount.toLocaleString()}</>
                )}
              </dd>
            </div>
            <div>
              <dt>{nl ? "Laatste gebeurtenis" : "Most recent"}</dt>
              <dd>{mostRecentLabel ?? "—"}</dd>
            </div>
          </dl>

          {(stream.invalidDates > 0 || stream.futureDated > 0) && (
            <p className="bento-stream__note">
              {stream.invalidDates > 0 && (
                <>
                  {nl
                    ? `${stream.invalidDates} ongeldige datum`
                    : `${stream.invalidDates} invalid date`}
                  {stream.futureDated > 0 ? " · " : ""}
                </>
              )}
              {stream.futureDated > 0 && (
                <>
                  {nl
                    ? `${stream.futureDated} toekomstig`
                    : `${stream.futureDated} future-dated`}
                </>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MovementStreamTile;
