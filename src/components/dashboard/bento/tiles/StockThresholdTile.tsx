import { useMemo, useState } from "react";
import type { InventoryItem } from "../../../../data/contracts";
import { summarizeStock, type StockLine } from "./stockThreshold";

interface Props {
  nl: boolean;
  inventory: InventoryItem[];
}

function statusLabel(status: StockLine["status"], nl: boolean): string {
  if (status === "below-min") return nl ? "Onder minimum" : "Below minimum";
  if (status === "reorder") return nl ? "Herbestellen" : "Reorder";
  if (status === "above-max") return nl ? "Boven maximum" : "Above maximum";
  if (status === "unconfigured")
    return nl ? "Niet geconfigureerd" : "Not configured";
  return nl ? "Gezond" : "Healthy";
}

export function StockThresholdTile({ nl, inventory }: Props) {
  const summary = useMemo(() => summarizeStock(inventory), [inventory]);
  const attention = summary.attentionLines;
  const [idx, setIdx] = useState(0);
  const safeIdx = attention.length === 0 ? 0 : idx % attention.length;
  const selected = attention[safeIdx];

  const prev = () =>
    setIdx((i) =>
      attention.length === 0 ? 0 : (i - 1 + attention.length) % attention.length,
    );
  const next = () =>
    setIdx((i) => (attention.length === 0 ? 0 : (i + 1) % attention.length));

  return (
    <section className="bento-tile" aria-labelledby="bento-stock-title">
      <header className="bento-tile__header">
        <h3 id="bento-stock-title" className="bento-tile__title">
          {nl ? "Voorraaddrempel" : "Stock threshold"}
        </h3>
        <span className="bento-tile__chip">
          {summary.totalEligible.toLocaleString()}{" "}
          {nl ? "voorraadregels" : "items"}
        </span>
      </header>

      {inventory.length === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen voorraaditems." : "No inventory items."}
        </p>
      ) : summary.totalEligible === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen bruikbare voorraadregels." : "No usable inventory lines."}
        </p>
      ) : (
        <>
          <dl className="bento-stock__kpis">
            <div className={summary.belowMin > 0 ? "bento-stock__kpi--warn" : undefined}>
              <dt>{nl ? "Onder min." : "Below min."}</dt>
              <dd>{summary.belowMin.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Herbestellen" : "Reorder"}</dt>
              <dd>{summary.reorder.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Gezond" : "Healthy"}</dt>
              <dd>{summary.healthy.toLocaleString()}</dd>
            </div>
            {summary.aboveMax > 0 && (
              <div>
                <dt>{nl ? "Boven max." : "Above max."}</dt>
                <dd>{summary.aboveMax.toLocaleString()}</dd>
              </div>
            )}
          </dl>

          {selected ? (
            <SelectedLine
              nl={nl}
              line={selected}
              atIndex={safeIdx}
              total={attention.length}
              onPrev={prev}
              onNext={next}
            />
          ) : (
            <p className="bento-stock__all-good" role="status">
              {nl
                ? "Alle geconfigureerde voorraden zijn gezond."
                : "All configured stock levels are healthy."}
            </p>
          )}

          {(summary.unconfigured > 0 || summary.invalid > 0) && (
            <p className="bento-stock__note">
              {summary.unconfigured > 0 && (
                <>
                  {summary.unconfigured.toLocaleString()}{" "}
                  {nl ? "regel(s) zonder drempel" : "item(s) without thresholds"}
                  {summary.invalid > 0 ? " · " : ""}
                </>
              )}
              {summary.invalid > 0 && (
                <>
                  {summary.invalid.toLocaleString()}{" "}
                  {nl ? "regel(s) met ongeldige waarden" : "item(s) with invalid values"}
                </>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SelectedLine({
  nl,
  line,
  atIndex,
  total,
  onPrev,
  onNext,
}: {
  nl: boolean;
  line: StockLine;
  atIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { item, available, status, configurationIssue } = line;
  const min = typeof item.minimum === "number" ? item.minimum : null;
  const reorder = typeof item.reorderLevel === "number" ? item.reorderLevel : null;
  const max = typeof item.maximum === "number" ? item.maximum : null;

  // Range envelope: only valid when both min and max are present.
  // Otherwise we show the markers but not an apparent-complete range bar.
  const canDrawRange = min !== null && max !== null && max > min;
  const span = canDrawRange ? (max as number) - (min as number) : 0;
  const pct = (v: number) =>
    canDrawRange
      ? Math.max(0, Math.min(100, ((v - (min as number)) / span) * 100))
      : 50;

  return (
    <div className="bento-stock__line">
      <div className="bento-stock__line-head">
        <div className="bento-stock__line-meta">
          <p className="bento-stock__item-name" title={item.name}>
            {item.name}
          </p>
          <p className="bento-stock__item-code">{item.code}</p>
        </div>
        <span
          className={
            "bento-cards__status bento-stock__chip bento-stock__chip--" + status
          }
        >
          {statusLabel(status, nl)}
        </span>
      </div>

      <dl className="bento-stock__facts">
        <div>
          <dt>{nl ? "Op voorraad" : "On hand"}</dt>
          <dd>{item.onHand.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{nl ? "Gereserveerd" : "Reserved"}</dt>
          <dd>{item.reserved.toLocaleString()}</dd>
        </div>
        <div className={available < 0 ? "bento-stock__kpi--warn" : undefined}>
          <dt>{nl ? "Beschikbaar" : "Available"}</dt>
          <dd>{available.toLocaleString()}</dd>
        </div>
        {min !== null && (
          <div>
            <dt>{nl ? "Minimum" : "Minimum"}</dt>
            <dd>{min.toLocaleString()}</dd>
          </div>
        )}
        {reorder !== null && (
          <div>
            <dt>{nl ? "Herbestel" : "Reorder"}</dt>
            <dd>{reorder.toLocaleString()}</dd>
          </div>
        )}
        {max !== null && (
          <div>
            <dt>{nl ? "Maximum" : "Maximum"}</dt>
            <dd>{max.toLocaleString()}</dd>
          </div>
        )}
      </dl>

      {canDrawRange ? (
        <div
          className="bento-stock__range"
          role="img"
          aria-label={
            nl
              ? `Bereik ${min} tot ${max}, beschikbaar ${available}`
              : `Range ${min} to ${max}, available ${available}`
          }
        >
          <div className="bento-stock__range-track" />
          {reorder !== null && reorder > (min as number) && reorder < (max as number) && (
            <div
              className="bento-stock__range-mark bento-stock__range-mark--reorder"
              style={{ left: `${pct(reorder)}%` }}
              aria-hidden="true"
            />
          )}
          <div
            className="bento-stock__range-marker"
            style={{ left: `${pct(available)}%` }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <p className="bento-stock__range-missing">
          {nl
            ? "Bereik niet volledig geconfigureerd."
            : "Range not fully configured."}
        </p>
      )}

      {configurationIssue && (
        <p className="bento-stock__note bento-stock__note--warn">
          {nl
            ? "Drempelconfiguratie is inconsistent."
            : "Threshold configuration is inconsistent."}
        </p>
      )}

      {total > 1 && (
        <div className="bento-stock__nav">
          <button type="button" onClick={onPrev} aria-label={nl ? "Vorige regel" : "Previous item"}>
            ‹
          </button>
          <span>
            {atIndex + 1} / {total}
          </span>
          <button type="button" onClick={onNext} aria-label={nl ? "Volgende regel" : "Next item"}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export default StockThresholdTile;
