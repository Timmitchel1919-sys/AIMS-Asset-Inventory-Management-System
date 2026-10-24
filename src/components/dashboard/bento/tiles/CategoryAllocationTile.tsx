import { useMemo } from "react";
import type { Asset } from "../../../../domain/types";

interface Props {
  nl: boolean;
  assets: Asset[];
  maxLegend?: number;
}

const PALETTE = [
  "#6b86f5",
  "#d9c4a4",
  "#86efac",
  "#fca5a5",
  "#c5c5d6",
  "#8e90a0",
];

const INACTIVE_STATUSES = new Set<string>(["Disposed", "Archived"]);

export function CategoryAllocationTile({ nl, assets, maxLegend = 6 }: Props) {
  const buckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      if (INACTIVE_STATUSES.has(asset.status)) continue;
      const key = (asset.category ?? "").trim() || (nl ? "Overig" : "Other");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, maxLegend - 1);
    const restTotal = entries
      .slice(maxLegend - 1)
      .reduce((sum, [, n]) => sum + n, 0);
    const list = [...top];
    if (restTotal > 0) list.push([nl ? "Overig" : "Other", restTotal]);
    const total = list.reduce((sum, [, n]) => sum + n, 0);
    return { list, total };
  }, [assets, maxLegend, nl]);

  if (buckets.total === 0) {
    return (
      <section
        className="bento-tile"
        aria-labelledby="bento-cat-title"
      >
        <header className="bento-tile__header">
          <h3 id="bento-cat-title" className="bento-tile__title">
            {nl ? "Categorie-verdeling" : "Category allocation"}
          </h3>
        </header>
        <p className="bento-empty">
          {nl ? "Geen middelen om te tonen." : "No assets to display."}
        </p>
      </section>
    );
  }

  return (
    <section className="bento-tile" aria-labelledby="bento-cat-title">
      <header className="bento-tile__header">
        <h3 id="bento-cat-title" className="bento-tile__title">
          {nl ? "Categorie-verdeling" : "Category allocation"}
        </h3>
      </header>

      <p className="bento-cat__total">{buckets.total.toLocaleString()}</p>

      <div
        className="bento-cat__bar"
        role="img"
        aria-label={
          nl
            ? `Verdeling over ${buckets.list.length} categorieën`
            : `Distribution across ${buckets.list.length} categories`
        }
      >
        {buckets.list.map(([label, count], i) => (
          <span
            key={label}
            className="bento-cat__seg"
            style={{
              flexBasis: `${(count / buckets.total) * 100}%`,
              background: PALETTE[i % PALETTE.length],
            }}
            title={`${label}: ${count}`}
          />
        ))}
      </div>

      <ul className="bento-cat__legend">
        {buckets.list.map(([label, count], i) => {
          const pct = ((count / buckets.total) * 100).toFixed(1);
          return (
            <li key={label} className="bento-cat__legend-row" title={label}>
              <span className="bento-cat__legend-name">
                <span
                  className="bento-cat__legend-dot"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                  aria-hidden="true"
                />
                <span className="bento-cat__legend-text">{label}</span>
              </span>
              <span className="bento-cat__legend-pct">
                {count.toLocaleString()} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default CategoryAllocationTile;
