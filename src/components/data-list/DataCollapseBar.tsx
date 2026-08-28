import { useApp } from "../../context/AppContext";
import { useT } from "../../i18n";

/**
 * Default preview size for every module table. The collapse control folds the
 * table down to this many rows; expanding shows the full result set.
 */
export const COLLAPSED_ROW_LIMIT = 30;

/**
 * Shared summary strip shown directly beneath every module's data panel:
 * bottom-left a small box with the total record count plus a "total records"
 * label, bottom-right a text "collapse" toggle.
 */
export function DataCollapseBar({
  total,
  collapsed,
  onToggle,
}: {
  total: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const { language } = useApp();
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const showToggle = total > COLLAPSED_ROW_LIMIT;

  return (
    <div className="data-collapse-bar">
      <span className="data-collapse-total">
        <b className="data-collapse-count">{total.toLocaleString(locale)}</b>
        <span className="data-collapse-label">{t("common.totalRecords")}</span>
      </span>
      {showToggle && (
        <button
          type="button"
          className="data-collapse-toggle"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {collapsed ? t("common.showAllData") : t("common.collapse")}
        </button>
      )}
    </div>
  );
}
