// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The Dashboard dispatcher must mount the Dark Bento content when the
 * Midnight / Dark Theme is active, and the existing Dashboard presentation
 * on every other theme. This test asserts the dispatch per theme without
 * exercising the full data pipeline.
 */

// Minimal snapshot that both Dashboard branches can safely consume.
const emptySnapshot = {
  assets: [],
  inventory: [],
  assignments: [],
  borrows: [],
  repairs: [],
  maintenance: [],
  movements: [],
  audits: [],
  auditDiscrepancies: [],
  correctiveActions: [],
  disposals: [],
  notifications: [],
  activity: [],
  assetHistoryEvents: [],
  qrIdentities: [],
  references: [],
  locationTypes: [],
  codeGroups: [],
  systemSettings: { hierarchyValidationMode: "strict" as const },
  users: [],
};

const theme = vi.hoisted(() => ({ value: "dark" as string }));

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    language: "en" as const,
    user: { id: "u1", name: "Owner", email: "o@kcs.example", role: "owner", department: "", initials: "O" },
    effectiveTheme: theme.value,
    theme: theme.value,
    formatDate: (v: string) => v,
    formatDateTime: (v: string) => v,
    setTheme: vi.fn(),
  }),
}));

vi.mock("../data/repositoryContext", () => ({
  useMockSnapshot: () => emptySnapshot,
  useRepositorySnapshot: () => emptySnapshot,
  useRepository: () => ({
    subscribe: () => () => {},
    snapshot: () => emptySnapshot,
  }),
}));

// Avoid loading the real MovementChart (recharts) which is heavy and needs ResizeObserver.
vi.mock("../components/dashboard/MovementChart", () => ({
  default: () => <div data-testid="movement-chart" />,
}));

import Dashboard from "./Dashboard";

afterEach(cleanup);

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard theme dispatcher", () => {
  it("renders the Dark Bento Dashboard when effectiveTheme is 'dark'", () => {
    theme.value = "dark";
    const { container } = renderDashboard();
    expect(container.querySelector(".bento-root")).not.toBeNull();
    // The legacy Dashboard surfaces a specific heading that must NOT appear here.
    expect(container.textContent).not.toContain("Inventory overview");
  });

  it("renders the legacy Dashboard on Azure Glass", () => {
    theme.value = "aimsAzureGlass";
    const { container } = renderDashboard();
    expect(container.querySelector(".bento-root")).toBeNull();
    expect(container.textContent).toContain("Inventory overview");
  });

  it("renders the legacy Dashboard on Emerald Gloss", () => {
    theme.value = "aimsEmeraldGloss";
    const { container } = renderDashboard();
    expect(container.querySelector(".bento-root")).toBeNull();
    expect(container.textContent).toContain("Inventory overview");
  });

  it("renders the legacy Dashboard on Light", () => {
    theme.value = "aimsLight";
    const { container } = renderDashboard();
    expect(container.querySelector(".bento-root")).toBeNull();
    expect(container.textContent).toContain("Inventory overview");
  });

  it("renders the legacy Dashboard on Premium Turquoise Glass", () => {
    theme.value = "aimsTurquoiseGlass";
    const { container } = renderDashboard();
    expect(container.querySelector(".bento-root")).toBeNull();
    expect(container.textContent).toContain("Inventory overview");
  });

  it("switches from Bento to legacy when the theme changes between renders", () => {
    theme.value = "dark";
    const { container, rerender } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector(".bento-root")).not.toBeNull();

    theme.value = "aimsLight";
    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector(".bento-root")).toBeNull();
    expect(container.textContent).toContain("Inventory overview");
  });
});
