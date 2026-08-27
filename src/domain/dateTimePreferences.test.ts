import { describe, expect, it } from "vitest";
import {
  formatMaybePreferredDateTime,
  formatPreferredDate,
  formatPreferredDateTime,
  formatPreferredTime,
  looksLikeDateValue,
} from "./dateTimePreferences";

describe("date and time preferences", () => {
  const value = new Date(2026, 7, 27, 13, 5);
  it("uses every supported date order", () => {
    expect(formatPreferredDate(value, "DD-MM-YYYY")).toBe("27-08-2026");
    expect(formatPreferredDate(value, "MM-DD-YYYY")).toBe("08-27-2026");
    expect(formatPreferredDate(value, "YYYY-MM-DD")).toBe("2026-08-27");
  });
  it("uses 24-hour and 12-hour clocks", () => {
    expect(formatPreferredTime(value, "24-hour")).toBe("13:05");
    expect(formatPreferredTime(value, "12-hour")).toBe("1:05 PM");
  });
  it("combines both preferences", () => {
    expect(formatPreferredDateTime(value, "MM-DD-YYYY", "12-hour")).toBe("08-27-2026 1:05 PM");
  });

  it("recognises only ISO date/date-time strings", () => {
    expect(looksLikeDateValue("2026-08-27")).toBe(true);
    expect(looksLikeDateValue("2026-08-27T13:05")).toBe(true);
    expect(looksLikeDateValue("2026-08-27T13:05:00.000Z")).toBe(true);
    expect(looksLikeDateValue("  2026-08-27  ")).toBe(true);
    expect(looksLikeDateValue("INV-2026-08")).toBe(false);
    expect(looksLikeDateValue("Excellent")).toBe(false);
    expect(looksLikeDateValue("—")).toBe(false);
    expect(looksLikeDateValue(42)).toBe(false);
  });

  it("only reformats values that look like dates and passes everything else through", () => {
    expect(formatMaybePreferredDateTime("2026-08-27", "MM-DD-YYYY", "24-hour")).toBe("08-27-2026");
    expect(formatMaybePreferredDateTime("2026-08-27T13:05", "DD-MM-YYYY", "12-hour")).toBe("27-08-2026 1:05 PM");
    expect(formatMaybePreferredDateTime("Warehouse A", "DD-MM-YYYY", "24-hour")).toBe("Warehouse A");
    expect(formatMaybePreferredDateTime("—", "DD-MM-YYYY", "24-hour")).toBe("—");
    expect(formatMaybePreferredDateTime(undefined, "DD-MM-YYYY", "24-hour")).toBeUndefined();
  });
});
