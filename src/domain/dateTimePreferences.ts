export type DateFormat = "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";
export type TimeFormat = "24-hour" | "12-hour";

const asDate = (value: string | number | Date) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const two = (value: number) => String(value).padStart(2, "0");

export function formatPreferredDate(value: string | number | Date, format: DateFormat) {
  const date = asDate(value);
  if (!date) return String(value);
  const day = two(date.getDate());
  const month = two(date.getMonth() + 1);
  const year = date.getFullYear();
  if (format === "MM-DD-YYYY") return `${month}-${day}-${year}`;
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${day}-${month}-${year}`;
}

export function formatPreferredTime(value: string | number | Date, format: TimeFormat) {
  const date = asDate(value);
  if (!date) return String(value);
  const minutes = two(date.getMinutes());
  if (format === "24-hour") return `${two(date.getHours())}:${minutes}`;
  const hour = date.getHours();
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatPreferredDateTime(value: string | number | Date, dateFormat: DateFormat, timeFormat: TimeFormat) {
  if (!asDate(value)) return String(value);
  return `${formatPreferredDate(value, dateFormat)} ${formatPreferredTime(value, timeFormat)}`;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/**
 * True when the value is an ISO date (`YYYY-MM-DD`) or ISO date-time
 * (`YYYY-MM-DDTHH:mm[...]`) string — the shape every date persisted in AIMS uses.
 * Anything else (labels, codes, free text) is left untouched.
 */
export function looksLikeDateValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return ISO_DATE_ONLY.test(trimmed) || ISO_DATE_TIME.test(trimmed);
}

/**
 * Formats a value with the user's preferences only when it looks like an ISO
 * date/date-time string; otherwise returns it verbatim. This lets any module
 * pass a mixed value (`asset.warrantyExpiry`, a status label, `"—"`) through a
 * single call and get preference-aware output where it matters.
 */
export function formatMaybePreferredDateTime(
  value: unknown,
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (ISO_DATE_TIME.test(trimmed)) return formatPreferredDateTime(trimmed, dateFormat, timeFormat);
  if (ISO_DATE_ONLY.test(trimmed)) return formatPreferredDate(trimmed, dateFormat);
  return value;
}
