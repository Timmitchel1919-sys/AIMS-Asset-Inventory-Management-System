// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MaintenanceIntelligenceTile } from "./MaintenanceIntelligenceTile";
import { computeMaintenanceKpis } from "./maintenanceKpis";
import type { Maintenance, MaintenanceStatus } from "../../../../domain/types";

const NOW = new Date("2026-10-24T12:00:00.000Z");

function m(
  id: string,
  status: MaintenanceStatus,
  nextDate: string | undefined,
): Maintenance {
  return {
    id,
    asset: id,
    assetCode: id,
    type: "preventive",
    frequency: "monthly",
    nextDate: nextDate ?? "",
    assignee: "",
    status,
  } as Maintenance;
}

describe("computeMaintenanceKpis", () => {
  it("counts Open while excluding Completed, Cancelled and Skipped", () => {
    const list = [
      m("1", "Scheduled", "2026-10-25T00:00:00.000Z"),
      m("2", "Completed", "2026-10-01T00:00:00.000Z"),
      m("3", "Cancelled", "2026-10-01T00:00:00.000Z"),
      m("4", "Skipped", "2026-10-01T00:00:00.000Z"),
      m("5", "In Progress", "2026-10-30T00:00:00.000Z"),
    ];
    const k = computeMaintenanceKpis(list, NOW);
    expect(k.open).toBe(2);
  });

  it("Due in 7 days includes dates within the window and excludes overdue", () => {
    // Dates are placed well inside / outside the window to stay timezone-safe.
    const list = [
      m("in-2-days", "Scheduled", "2026-10-26T12:00:00.000Z"),
      m("in-5-days", "Scheduled", "2026-10-29T12:00:00.000Z"),
      m("far-future", "Scheduled", "2026-11-05T12:00:00.000Z"), // clearly past horizon
      m("overdue", "Scheduled", "2026-10-20T00:00:00.000Z"),
    ];
    const k = computeMaintenanceKpis(list, NOW);
    expect(k.dueSoon).toBe(2);
    expect(k.overdue).toBe(1); // overdue-by-date
  });

  it("counts Overdue once per record even when status AND date both qualify", () => {
    const list = [
      m("double", "Overdue", "2026-10-20T00:00:00.000Z"),
    ];
    const k = computeMaintenanceKpis(list, NOW);
    expect(k.overdue).toBe(1);
    expect(k.dueSoon).toBe(0);
    expect(k.open).toBe(1);
  });

  it("treats invalid or missing nextDate on open tasks as 'invalid date' rather than silently counting as due", () => {
    const list = [
      m("1", "Scheduled", undefined),
      m("2", "Scheduled", "not-a-date"),
    ];
    const k = computeMaintenanceKpis(list, NOW);
    expect(k.open).toBe(2);
    expect(k.dueSoon).toBe(0);
    expect(k.overdue).toBe(0);
    expect(k.invalidDates).toBe(2);
  });

  it("uses local-day boundaries so a task scheduled 'today' at any clock time counts as due in 7 days", () => {
    // A task scheduled 'today' at 14:00 local time MUST be counted dueSoon
    // regardless of the test machine's timezone offset.
    const todayAtLocalTwoPm = new Date(NOW);
    todayAtLocalTwoPm.setHours(14, 0, 0, 0);
    const list = [m("today-2pm", "Scheduled", todayAtLocalTwoPm.toISOString())];
    const k = computeMaintenanceKpis(list, NOW);
    expect(k.open).toBe(1);
    expect(k.dueSoon).toBe(1);
    expect(k.overdue).toBe(0);
  });

  it("7-day schedule has 7 buckets and does not include overdue tasks", () => {
    const list = [
      m("1", "Scheduled", "2026-10-25T00:00:00.000Z"),
      m("overdue", "Overdue", "2026-10-20T00:00:00.000Z"),
    ];
    const k = computeMaintenanceKpis(list, NOW);
    expect(k.schedule.length).toBe(7);
    const totalInWindow = k.schedule.reduce((s, b) => s + b.count, 0);
    expect(totalInWindow).toBe(1);
  });
});

describe("MaintenanceIntelligenceTile", () => {
  it("shows the empty-state when there are no maintenance records", () => {
    const { container } = render(
      <MaintenanceIntelligenceTile nl={false} maintenance={[]} now={NOW} />,
    );
    expect(container.textContent).toContain("No maintenance records available");
  });

  it("shows an 'open 0' empty-state when all records are terminal", () => {
    const list = [m("1", "Completed", "2026-10-01T00:00:00.000Z")];
    const { container } = render(
      <MaintenanceIntelligenceTile nl={false} maintenance={list} now={NOW} />,
    );
    expect(container.textContent).toContain("No open maintenance tasks");
  });
});
