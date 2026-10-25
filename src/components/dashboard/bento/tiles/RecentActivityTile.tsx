import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Wrench,
  Package,
} from "lucide-react";
import type { Movement } from "../../../../domain/types";

interface Props {
  nl: boolean;
  movements: Movement[];
  limit?: number;
  formatDateTime?: (date: string) => string;
}

type Kind = "issue" | "return" | "transfer" | "repair" | "receive" | "other";

function classify(type: string): Kind {
  const t = type.toLowerCase();
  if (/return/.test(t)) return "return";
  if (/issue|checkout|assign/.test(t)) return "issue";
  if (/transfer|move/.test(t)) return "transfer";
  if (/repair|maintenance|service/.test(t)) return "repair";
  if (/receive|intake|incoming/.test(t)) return "receive";
  return "other";
}

function KindIcon({ kind }: { kind: Kind }) {
  const props = { width: 16, height: 16, "aria-hidden": true } as const;
  if (kind === "return") return <ArrowDownLeft {...props} />;
  if (kind === "issue") return <ArrowUpRight {...props} />;
  if (kind === "transfer") return <Repeat {...props} />;
  if (kind === "repair") return <Wrench {...props} />;
  return <Package {...props} />;
}

export function RecentActivityTile({
  nl,
  movements,
  limit = 5,
  formatDateTime,
}: Props) {
  const rows = useMemo(() => {
    return [...movements]
      .filter((m) => Boolean(m.date))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);
  }, [movements, limit]);

  return (
    <section
      className="bento-tile bento-tile--span-2"
      aria-labelledby="bento-act-title"
    >
      <header className="bento-tile__header">
        <h3 id="bento-act-title" className="bento-tile__title">
          {nl ? "Recente activiteit" : "Recent asset activity"}
        </h3>
      </header>

      {rows.length === 0 ? (
        <p className="bento-empty">
          {nl ? "Geen recente bewegingen." : "No recent movements."}
        </p>
      ) : (
        <ul className="bento-act__list">
          {rows.map((m) => {
            const kind = classify(m.type);
            const label = m.type || (nl ? "Beweging" : "Movement");
            const detail = [m.by, m.from && m.to && `${m.from} → ${m.to}`]
              .filter(Boolean)
              .join(" · ");
            const when = formatDateTime
              ? formatDateTime(m.date)
              : m.date.slice(0, 16).replace("T", " ");
            const qty = typeof m.quantity === "number" ? m.quantity : 1;
            // Movements are status events, not stock-balance deltas; show the
            // quantity verbatim and let the event type carry the direction.
            return (
              <li key={m.id} className="bento-act__row">
                <span className="bento-act__icon">
                  <KindIcon kind={kind} />
                </span>
                <div className="bento-act__meta">
                  <p className="bento-act__title">
                    {label}
                    {m.assetCode ? ` · ${m.assetCode}` : ""}
                  </p>
                  <p className="bento-act__detail">
                    {detail || (nl ? "Geen details" : "No details")} · {when}
                  </p>
                </div>
                <div className="bento-act__right">
                  <p className="bento-act__amount">
                    {nl ? "aantal " : "qty "}
                    {qty.toLocaleString()}
                  </p>
                  <p className="bento-act__status">
                    {nl
                      ? kind === "return"
                        ? "Retour"
                        : kind === "issue"
                          ? "Uitgave"
                          : kind === "transfer"
                            ? "Transfer"
                            : kind === "repair"
                              ? "Reparatie"
                              : kind === "receive"
                                ? "Ontvangen"
                                : "Overig"
                      : kind}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default RecentActivityTile;
