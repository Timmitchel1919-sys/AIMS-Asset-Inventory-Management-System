import { useMemo } from "react";
import type { Asset } from "../../../../domain/types";
import { computeAgeDistribution, type AgeBucket } from "./assetAge";

interface Props {
  nl: boolean;
  assets: Asset[];
  now?: Date;
}

const BUCKETS: { key: AgeBucket; en: string; nl: string; tone: string }[] = [
  { key: "lt1", en: "< 1 year", nl: "< 1 jaar", tone: "fresh" },
  { key: "1to3", en: "1–3 years", nl: "1–3 jaar", tone: "mid" },
  { key: "3to5", en: "3–5 years", nl: "3–5 jaar", tone: "aged" },
  { key: "ge5", en: "5+ years", nl: "5+ jaar", tone: "senior" },
  { key: "unknown", en: "Unknown", nl: "Onbekend", tone: "unknown" },
];

export function AssetAgeTile({ nl, assets, now }: Props) {
  const d = useMemo(
    () => computeAgeDistribution(assets, now ?? new Date()),
    [assets, now],
  );

  const total = d.totalActive;
  const pct = (n: number) =>
    total === 0 ? 0 : Math.round((n / total) * 1000) / 10;

  return (
    <section className="bento-tile" aria-labelledby="bento-age-title">
      <header className="bento-tile__header">
        <h3 id="bento-age-title" className="bento-tile__title">
          {nl ? "Leeftijd & Levenscyclus" : "Asset age & lifecycle"}
        </h3>
        <span
          className="bento-tile__chip"
          title={
            nl
              ? "Beschrijvende statistiek — geen financiële afschrijving"
              : "Descriptive metric — not financial depreciation"
          }
        >
          {nl ? "beschrijvend" : "descriptive"}
        </span>
      </header>

      {total === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen actieve middelen." : "No active assets."}
        </p>
      ) : (
        <>
          <p className="bento-age__total">
            {d.withValidDate.toLocaleString()}
            <span>
              {" / "}
              {total.toLocaleString()}{" "}
              {nl ? "met aankoopdatum" : "with purchase date"}
            </span>
          </p>

          <ul
            className="bento-age__bars"
            role="img"
            aria-label={
              nl
                ? `Leeftijdsverdeling over ${total} actieve middelen`
                : `Age distribution across ${total} active assets`
            }
          >
            {BUCKETS.map((bucket) => {
              const count = d.buckets[bucket.key];
              const w = total === 0 ? 0 : (count / total) * 100;
              return (
                <li key={bucket.key} className={"bento-age__row bento-age__row--" + bucket.tone}>
                  <div className="bento-age__row-head">
                    <span>{nl ? bucket.nl : bucket.en}</span>
                    <span className="bento-age__row-num">
                      {count.toLocaleString()} · {pct(count)}%
                    </span>
                  </div>
                  <div className="bento-age__bar-track" aria-hidden="true">
                    <div
                      className="bento-age__bar-fill"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="bento-age__facts">
            <div>
              <dt>{nl ? "5+ jaar" : "5+ years"}</dt>
              <dd>{d.buckets.ge5.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{nl ? "Oudste (jaren)" : "Oldest (yrs)"}</dt>
              <dd>{d.oldestYears === null ? "—" : d.oldestYears}</dd>
            </div>
            {d.invalidDate > 0 && (
              <div>
                <dt>{nl ? "Onbekende datum" : "Unknown date"}</dt>
                <dd>{d.invalidDate.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

export default AssetAgeTile;
