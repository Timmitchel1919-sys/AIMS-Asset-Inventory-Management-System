// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assets } from "../data/mock";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(async () => ({
    updated: 1,
    skippedChanged: 0,
    skippedMissing: 0,
    failedAssets: [] as string[],
    fieldsWritten: 2,
  })),
  types: [] as unknown[],
}));

vi.mock("../context/AppContext", () => ({
  useApp: () => ({ language: "en", user: { id: "owner", name: "Owner", role: "owner" } }),
}));
vi.mock("../data/repositoryContext", () => ({
  useMockSnapshot: () => ({
    assets: [{ ...assets[0], id: "a1", code: "KCSL-001", codePrefix: "KCSL", category: "Laptops", department: "", assignedTo: "", categoryId: undefined, assetTypeId: undefined, codeGroupId: undefined }],
    references: [{ id: "cat1", kind: "category", name: "Laptops", status: "Active", details: { level: "asset_name" } }],
    codeGroups: [{ id: "cg1", name: "Laptops", prefix: "KCSL" }],
    users: [],
  }),
}));
vi.mock("../data/assetTypesStore", () => ({
  useAssetTypes: () => ({ items: mocks.types, loading: false, error: "", connected: true }),
}));
vi.mock("../data/referenceMigrationApply", () => ({ applyReferenceMigration: mocks.apply }));

import ReferenceMigration from "./ReferenceMigration";

const renderPage = () =>
  render(
    <MemoryRouter>
      <ReferenceMigration />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.apply.mockClear();
  mocks.types = [{ id: "serialized", name: "Serialized", description: "", behavior: "SERIALIZED", status: "Active" }];
});
afterEach(cleanup);

describe("ReferenceMigration page", () => {
  it("shows nothing and writes nothing until a report is requested", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /^Apply/ })).toBeNull();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation of the report before applying", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Create report/ }));
    const apply = screen.getByRole("button", { name: /^Apply/ });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(mocks.apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed the report/ }));
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(1));
    const plans = (mocks.apply.mock.calls[0] as unknown[])[0] as { assetId: string }[];
    expect(plans[0].assetId).toBe("a1");
    expect(await screen.findByText("Assets updated")).toBeInTheDocument();
  });

  it("warns when the default tracking type does not exist yet and still reports", () => {
    mocks.types = [];
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/Serialized/);
    fireEvent.click(screen.getByRole("button", { name: /Create report/ }));
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
  });
});
