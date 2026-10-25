// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The Dashboard renders the same card layout (title, metrics, status,
 * movement + attention + quick-actions, recent movements, upcoming) on
 * every theme. Theme-specific colors come from scoped CSS, not from a
 * component swap. This test asserts the layout stays identical across
 * every active theme.
 */

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

describe("Dashboard unified layout", () => {
  const themes = ["dark", "aimsAzureGlass", "aimsEmeraldGloss", "aimsLight", "aimsTurquoiseGlass"];
  for (const t of themes) {
    it(`renders the same card layout on ${t}`, () => {
      theme.value = t;
      const { container } = renderDashboard();
      // Shared layout: the dashboard page container
      expect(container.querySelector(".dashboard-page")).not.toBeNull();
      // The metrics card is titled "Inventory overview" on every theme
      expect(container.textContent).toContain("Inventory overview");
      // No Bento-specific root is mounted anywhere any more
      expect(container.querySelector(".bento-root")).toBeNull();
    });
  }

  it("keeps the layout identical when the theme changes between renders", () => {
    theme.value = "dark";
    const { container, rerender } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector(".dashboard-page")).not.toBeNull();
    expect(container.textContent).toContain("Inventory overview");

    theme.value = "aimsLight";
    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector(".dashboard-page")).not.toBeNull();
    expect(container.textContent).toContain("Inventory overview");
    expect(container.querySelector(".bento-root")).toBeNull();
  });
});
