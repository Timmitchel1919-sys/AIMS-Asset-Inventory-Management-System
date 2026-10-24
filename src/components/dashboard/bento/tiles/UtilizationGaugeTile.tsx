import { useMemo } from "react";
import type { Asset } from "../../../../domain/types";
import { classifyUtilization } from "./utilizationBuckets";

interface Props {
  nl: boolean;
  assets: Asset[];
}

export function UtilizationGaugeTile({ nl, assets }: Props) {
  const b = useMemo(() => classifyUtilization(assets), [assets]);

  // Semicircle gauge: 62px radius, 180° arc.
  const R = 62;
  const CIRC = Math.PI * R;
  const fraction = Math.min(1, Math.max(0, b.utilizationPct / 100));
  const dashOffset = CIRC * (1 - fraction);

  const ariaLabel = nl
    ? `Benutting ${b.utilizationPct}%: ${b.inUse} van ${b.activeTotal} actieve middelen in gebruik`
    : `Utilization ${b.utilizationPct}%: ${b.inUse} of ${b.activeTotal} active assets in use`;

  return (
    <section className="bento-tile" aria-labelledby="bento-util-title">
      <header className="bento-tile__header">
        <h3 id="bento-util-title" className="bento-tile__title">
          {nl ? "Benutting" : "Utilization"}
        </h3>
        <span
          className="bento-tile__chip"
          title={
            nl
              ? "In-use ÷ actieve middelen (Toegewezen + Uitgeleend)"
              : "In-use ÷ active assets (Assigned + Borrowed)"
          }
        >
          {nl ? "operationeel" : "operational"}
        </span>
      </header>

      {b.activeTotal === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen actieve middelen om te meten." : "No active assets to measure."}
        </p>
      ) : (
        <>
          <div className="bento-gauge" role="img" aria-label={ariaLabel}>
            <svg width="150" height="86" viewBox="0 0 150 86" aria-hidden="true">
              <path
                d="M 13 78 A 62 62 0 0 1 137 78"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                className="bento-gauge__track"
              />
              <path
                d="M 13 78 A 62 62 0 0 1 137 78"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                className="bento-gauge__value"
              />
            </svg>
            <p className="bento-gauge__pct">
              {b.utilizationPct}
              <span>%</span>
            </p>
            <p className="bento-gauge__sub">
              {b.inUse.toLocaleString()}
              {" / "}
              {b.activeTotal.toLocaleString()}{" "}
              {nl ? "in gebruik" : "in use"}
            </p>
          </div>

          <dl className="bento-gauge__dist">
            <div>
              <dt>{nl ? "In gebruik" : "In use"}</dt>
              <dd>{b.inUse.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Beschikbaar" : "Available"}</dt>
              <dd>{b.available.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Gereserveerd" : "Reserved"}</dt>
              <dd>{b.reserved.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Service" : "Service"}</dt>
              <dd>{b.service.toLocaleString()}</dd>
            </div>
            {b.retired > 0 && (
              <div className="bento-gauge__dist-muted">
                <dt>{nl ? "Afgeschreven" : "Retired"}</dt>
                <dd>{b.retired.toLocaleString()}</dd>
              </div>
            )}
            {b.unknown > 0 && (
              <div className="bento-gauge__dist-unknown">
                <dt>{nl ? "Onbekend" : "Unknown"}</dt>
                <dd>{b.unknown.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

export default UtilizationGaugeTile;
