import { describe, expect, it } from "vitest";
import { formatPreferredDate, formatPreferredDateTime, formatPreferredTime } from "./dateTimePreferences";

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
});
