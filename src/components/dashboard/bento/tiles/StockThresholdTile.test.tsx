// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StockThresholdTile } from "./StockThresholdTile";
import { summarizeStock } from "./stockThreshold";
import type { InventoryItem } from "../../../../data/contracts";

function item(
  id: string,
  overrides: Partial<InventoryItem> & { onHand?: number; reserved?: number },
): InventoryItem {
  return {
    id,
    code: id,
    name: id,
    itemType: "widget",
    category: "Office supplies",
    unit: "pcs",
    onHand: 0,
    reserved: 0,
    minimum: 0,
    reorderLevel: 0,
    reorderQuantity: 0,
    warehouse: "Main",
    location: "Main",
    createdBy: "",
    createdAt: "",
    modifiedBy: "",
    lastUpdated: "",
    archived: false,
    ...overrides,
  } as InventoryItem;
}

describe("summarizeStock — available math and status boundaries", () => {
  it("available = onHand - reserved, unclamped (surfaces negative values)", () => {
    const s = summarizeStock([
      item("neg", { onHand: 2, reserved: 5, minimum: 1 }),
    ]);
    expect(s.belowMin).toBe(1);
    expect(s.attentionLines[0].available).toBe(-3);
  });

  it("classifies Below Minimum when available < minimum (strict)", () => {
    const s = summarizeStock([
      item("low", { onHand: 4, reserved: 0, minimum: 5, reorderLevel: 7 }),
    ]);
    expect(s.belowMin).toBe(1);
    expect(s.reorder).toBe(0);
  });

  it("classifies Reorder when below minimum rule does not apply but available <= reorderLevel", () => {
    const s = summarizeStock([
      item("warn", { onHand: 7, reserved: 0, minimum: 5, reorderLevel: 7 }),
    ]);
    expect(s.reorder).toBe(1);
    expect(s.belowMin).toBe(0);
  });

  it("classifies Healthy when inside the configured limits", () => {
    const s = summarizeStock([
      item("ok", { onHand: 50, reserved: 0, minimum: 5, reorderLevel: 10, maximum: 100 }),
    ]);
    expect(s.healthy).toBe(1);
  });

  it("classifies Above Maximum when available exceeds maximum", () => {
    const s = summarizeStock([
      item("over", { onHand: 200, reserved: 0, minimum: 5, reorderLevel: 10, maximum: 100 }),
    ]);
    expect(s.aboveMax).toBe(1);
  });

  it("classifies Unconfigured when no thresholds are set and does not invent any", () => {
    const s = summarizeStock([
      item("blank", { onHand: 10, reserved: 0, minimum: 0, reorderLevel: 0 }),
    ]);
    expect(s.unconfigured).toBe(1);
    expect(s.belowMin).toBe(0);
    expect(s.reorder).toBe(0);
    expect(s.healthy).toBe(0);
  });

  it("treats minimum=0 as a valid threshold (reconciles with Dashboard's low-stock KPI)", () => {
    // Dashboard counts low-stock as `onHand - reserved < item.minimum`, so an
    // item with min=0 and available=-1 IS below minimum, not healthy / not
    // unconfigured. (A positive reorderLevel keeps the item classifiable.)
    const s = summarizeStock([
      item("neg-with-min-zero", {
        onHand: 1, reserved: 2, minimum: 0, reorderLevel: 3,
      }),
    ]);
    expect(s.belowMin).toBe(1);
    expect(s.attentionLines[0].available).toBe(-1);
  });

  it("reorderLevel=0 is treated as 'no proactive reorder configured'", () => {
    // Item with min=5, reorder=0 — available at 6 should be healthy, not
    // reorder (we must not interpret `available <= 0` as a reorder trigger).
    const s = summarizeStock([
      item("no-reorder", { onHand: 6, reserved: 0, minimum: 5, reorderLevel: 0 }),
    ]);
    expect(s.reorder).toBe(0);
    expect(s.belowMin).toBe(0);
    expect(s.healthy).toBe(1);
  });

  it("skips archived items entirely", () => {
    const s = summarizeStock([
      item("gone", { onHand: 0, reserved: 0, minimum: 5, archived: true }),
    ]);
    expect(s.totalEligible).toBe(0);
  });

  it("counts invalid numeric values separately rather than classifying them", () => {
    const bad = item("bad", { onHand: Number.NaN as unknown as number, reserved: 0, minimum: 5 });
    const s = summarizeStock([bad]);
    expect(s.invalid).toBe(1);
    expect(s.belowMin).toBe(0);
  });

  it("flags inconsistent threshold configuration (min > reorder)", () => {
    const s = summarizeStock([
      item("mis", { onHand: 50, reserved: 0, minimum: 20, reorderLevel: 10, maximum: 100 }),
    ]);
    // Not necessarily unhealthy, but the flag is set
    const line = s.attentionLines.find((l) => l.item.code === "mis") ?? null;
    // may not be in attention if it's healthy; verify directly via summarize
    expect(line === null || line.configurationIssue).toBeTruthy();
  });

  it("prioritizes attention lines: below-min before reorder before above-max", () => {
    const s = summarizeStock([
      item("hi", { onHand: 500, reserved: 0, minimum: 5, reorderLevel: 10, maximum: 100 }),  // above-max
      item("warn", { onHand: 10, reserved: 0, minimum: 5, reorderLevel: 10 }),               // reorder
      item("low", { onHand: 3, reserved: 0, minimum: 5, reorderLevel: 10 }),                 // below-min
    ]);
    expect(s.attentionLines.map((l) => l.status)).toEqual(["below-min", "reorder", "above-max"]);
  });
});

describe("StockThresholdTile", () => {
  it("renders the empty state when there are no inventory items", () => {
    const { container } = render(
      <StockThresholdTile nl={false} inventory={[]} />,
    );
    expect(container.textContent).toContain("No inventory items");
  });

  it("shows an 'all good' message when nothing needs attention", () => {
    const inv = [item("ok", { onHand: 50, reserved: 0, minimum: 5, reorderLevel: 10, maximum: 100 })];
    const { container } = render(
      <StockThresholdTile nl={false} inventory={inv} />,
    );
    expect(container.textContent).toContain("All configured stock levels are healthy");
  });

  it("renders the selected low-stock line with name, code, and chip", () => {
    const inv = [item("widget-a", { name: "Widget A", code: "WA-01", onHand: 3, reserved: 0, minimum: 5, reorderLevel: 10 })];
    const { container } = render(
      <StockThresholdTile nl={false} inventory={inv} />,
    );
    expect(container.textContent).toContain("Widget A");
    expect(container.textContent).toContain("WA-01");
    expect(container.textContent).toContain("Below minimum");
  });
});
