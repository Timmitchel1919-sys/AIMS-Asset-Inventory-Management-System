// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MovementStreamTile } from "./MovementStreamTile";
import {
  classifyMovementType,
  computeMovementStream,
} from "./movementStream";
import type { Movement } from "../../../../domain/types";

const NOW = new Date("2026-10-24T12:00:00.000Z");

function m(id: string, type: string, date: string, quantity = 1): Movement {
  return {
    id,
    reference: "R-" + id,
    type,
    asset: "x",
    assetCode: "ICT-" + id,
    from: "A",
    to: "B",
    by: "User",
    date,
    quantity,
  } as Movement;
}

describe("computeMovementStream", () => {
  it("generates exactly 14 buckets, oldest to newest", () => {
    const s = computeMovementStream([], NOW);
    expect(s.buckets).toHaveLength(14);
    const first = new Date(s.buckets[0].date);
    const last = new Date(s.buckets[s.buckets.length - 1].date);
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((last.getTime() - first.getTime()) / dayMs);
    expect(diffDays).toBe(13);
  });

  it("counts events (NOT quantities) within the window", () => {
    const list = [
      m("1", "Issue", "2026-10-23T10:00:00.000Z", 5),  // qty=5 but still ONE event
      m("2", "Return", "2026-10-22T10:00:00.000Z", 1),
      m("3", "Transfer", "2026-10-22T18:00:00.000Z", 1),
    ];
    const s = computeMovementStream(list, NOW);
    expect(s.totalEvents).toBe(3); // not 7
  });

  it("multiple events on the same day accumulate into a single bucket", () => {
    const list = [
      m("1", "Issue", "2026-10-20T08:00:00.000Z"),
      m("2", "Return", "2026-10-20T12:00:00.000Z"),
      m("3", "Transfer", "2026-10-20T16:00:00.000Z"),
    ];
    const s = computeMovementStream(list, NOW);
    const day = s.buckets.find((b) => b.date === "2026-10-20");
    expect(day?.count).toBe(3);
    expect(s.totalEvents).toBe(3);
    expect(s.peakDate).toBe("2026-10-20");
    expect(s.peakCount).toBe(3);
  });

  it("excludes events older than 14 days", () => {
    const list = [
      m("in", "Issue", "2026-10-20T10:00:00.000Z"), // 4 days ago
      m("out", "Issue", "2026-09-01T10:00:00.000Z"), // way before window
    ];
    const s = computeMovementStream(list, NOW);
    expect(s.totalEvents).toBe(1);
  });

  it("future-dated events are counted separately, not in the activity total", () => {
    const list = [
      m("today", "Issue", "2026-10-24T10:00:00.000Z"),
      m("tomorrow", "Issue", "2026-10-25T10:00:00.000Z"),
    ];
    const s = computeMovementStream(list, NOW);
    expect(s.totalEvents).toBe(1);
    expect(s.futureDated).toBe(1);
  });

  it("invalid dates are counted separately and never silently placed in a bucket", () => {
    const list = [
      m("ok", "Issue", "2026-10-23T10:00:00.000Z"),
      m("bad1", "Issue", "not-a-date"),
      m("bad2", "Issue", ""),
    ];
    const s = computeMovementStream(list, NOW);
    expect(s.totalEvents).toBe(1);
    expect(s.invalidDates).toBe(2);
    const totalInBuckets = s.buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalInBuckets).toBe(1);
  });

  it("tracks the most recent valid in-window event", () => {
    const list = [
      m("old", "Issue", "2026-10-15T10:00:00.000Z"),
      m("recent", "Return", "2026-10-23T22:00:00.000Z"),
    ];
    const s = computeMovementStream(list, NOW);
    expect(s.mostRecent?.toISOString()).toBe("2026-10-23T22:00:00.000Z");
  });

  it("peakDate is null and peakCount is 0 when there are no events in the window", () => {
    const s = computeMovementStream([], NOW);
    expect(s.peakDate).toBeNull();
    expect(s.peakCount).toBe(0);
  });
});

describe("classifyMovementType", () => {
  it("maps canonical AIMS types to the agreed kinds", () => {
    expect(classifyMovementType("Issue")).toBe("issue");
    expect(classifyMovementType("Return")).toBe("return");
    expect(classifyMovementType("Transfer")).toBe("transfer");
    expect(classifyMovementType("Repair")).toBe("repair");
    expect(classifyMovementType("Maintenance")).toBe("maintenance");
    expect(classifyMovementType("Receive")).toBe("receive");
    expect(classifyMovementType("mystery-event")).toBe("other");
  });
});

describe("MovementStreamTile", () => {
  it("renders the empty state when there are no records", () => {
    const { container } = render(
      <MovementStreamTile nl={false} movements={[]} now={NOW} />,
    );
    expect(container.textContent).toContain("No movement records available");
  });

  it("renders an in-window empty state when records exist but none in 14 days", () => {
    const list = [m("1", "Issue", "2026-01-01T10:00:00.000Z")];
    const { container } = render(
      <MovementStreamTile nl={false} movements={list} now={NOW} />,
    );
    expect(container.textContent).toContain("No movements in the last 14 days");
  });

  it("renders a 14-bar chart with an accessible aria-label", () => {
    const list = [m("1", "Issue", "2026-10-23T10:00:00.000Z")];
    const { container } = render(
      <MovementStreamTile nl={false} movements={list} now={NOW} />,
    );
    const bars = container.querySelectorAll(".bento-stream__bar");
    expect(bars.length).toBe(14);
    const chart = container.querySelector(".bento-stream__chart");
    expect(chart?.getAttribute("aria-label")).toMatch(
      /Daily movement events from/,
    );
  });
});
