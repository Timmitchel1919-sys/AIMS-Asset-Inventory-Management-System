// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockInventoryRepository } from "../../data/mockRepository";
import { RepositoryProvider } from "../../data/repositoryContext";

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({ language: "nl", user: { id: "u1", name: "Ann", email: "ann@kangoeroeschool.com", role: "warehouse-staff" } }),
}));

import { MainLocationForm } from "./MainLocationForm";

let repo: MockInventoryRepository;
beforeEach(() => {
  localStorage.setItem("kcs-language", "nl");
  repo = new MockInventoryRepository();
});
afterEach(cleanup);

const mainLocations = () => repo.snapshot().references.filter((r) => r.kind === "location" && r.type === "Main location");
const createMain = (name: string, prefix: string) =>
  repo.execute({
    action: "reference.create",
    values: { kind: "location", name, type: "Main location", typeId: "main-location", status: "Active", details: { prefix } },
  });

describe("Hoofdlocatie lifecycle", () => {
  it("deactivating keeps the record, its assets and its name reserved; reactivating restores it", async () => {
    const created = await createMain("Kangoeroe Test Bouw", "KTB");
    expect(created.ok, created.message).toBe(true);
    const id = created.entityId!;
    const assetsBefore = JSON.stringify(repo.snapshot().assets);

    const off = await repo.execute({ action: "reference.edit", entityId: id, values: { status: "Inactive" } });
    expect(off.ok, off.message).toBe(true);
    const record = () => mainLocations().find((r) => r.id === id)!;
    expect(record()).toMatchObject({ status: "Inactive", name: "Kangoeroe Test Bouw", details: expect.objectContaining({ prefix: "KTB" }) });
    expect(JSON.stringify(repo.snapshot().assets)).toBe(assetsBefore);

    // An inactive location still owns its name and code.
    expect((await createMain("kangoeroe  test bouw", "OTHER")).ok).toBe(false);
    expect((await createMain("Another", "ktb")).ok).toBe(false);

    await repo.execute({ action: "reference.edit", entityId: id, values: { status: "Active" } });
    expect(record().status).toBe("Active");
  });

  it("blocks duplicate Hoofdlocatie names (ignoring case and spacing) and codes", async () => {
    await createMain("KCS Bovenbouw", "KBB");
    const name = await createMain("  kcs   BOVENBOUW ", "NEW");
    expect(name.ok).toBe(false);
    expect(name.message).toBe("Main location already exists.");
    const code = await createMain("Brand New", "kbb");
    expect(code.ok).toBe(false);
    expect(code.message).toBe("This location code is already in use.");
  });
});

describe("Codegroepen have no range", () => {
  it("accepts any number of assets and numbers beyond any fixed range", async () => {
    const group = await repo.execute({ action: "codeGroup.create", values: { name: "Unlimited", prefix: "UNLIM" } });
    expect(group.ok, group.message).toBe(true);
    // A code number far above any former 5,000 / 10,000 limit is valid.
    const created = await repo.execute({
      action: "asset.create",
      values: { name: "Far out", serialNumber: "FAR-1", codePrefix: "UNLIM", codeNumber: 123456 },
    });
    expect(created.ok, created.message).toBe(true);
    expect(repo.snapshot().assets.find((a) => a.id === created.entityId)?.code).toBe("UNLIM-123456");
    // The next generated code continues after the highest one actually used.
    const next = await repo.execute({ action: "asset.create", values: { name: "Next", serialNumber: "FAR-2", codePrefix: "UNLIM" } });
    expect(repo.snapshot().assets.find((a) => a.id === next.entityId)?.code).toBe("UNLIM-123457");
  });

  it("blocks a duplicate code group name and prefix", async () => {
    await repo.execute({ action: "codeGroup.create", values: { name: "Boards", prefix: "BRDX" } });
    expect((await repo.execute({ action: "codeGroup.create", values: { name: "boards", prefix: "OTHERX" } })).ok).toBe(false);
    expect((await repo.execute({ action: "codeGroup.create", values: { name: "Different", prefix: "brdx" } })).ok).toBe(false);
  });
});

describe("MainLocationForm", () => {
  const renderForm = (editing: Parameters<typeof MainLocationForm>[0]["editing"] = null) =>
    render(
      <RepositoryProvider repository={repo}>
        <MainLocationForm onSaved={() => undefined} onCancel={() => undefined} editing={editing} />
      </RepositoryProvider>,
    );

  it("requires a location code for a new Hoofdlocatie and shows a red error", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Naam hoofdlocatie/), { target: { value: "Zonder code" } });
    fireEvent.submit(screen.getByRole("button", { name: /opslaan|toevoegen/i }).closest("form")!);
    expect(await screen.findByText("Locatiecode is verplicht.")).toBeInTheDocument();
    expect(mainLocations().some((r) => r.name === "Zonder code")).toBe(false);
  });

  it("creates the location when name and code are given, and offers Actief/Inactief", async () => {
    renderForm();
    expect(screen.getByRole("option", { name: "Inactief" })).toHaveValue("Inactive");
    fireEvent.change(screen.getByLabelText(/Naam hoofdlocatie/), { target: { value: "Nieuw Gebouw" } });
    fireEvent.change(screen.getByLabelText(/^Locatiecode/), { target: { value: "ngb" } });
    fireEvent.submit(screen.getByRole("button", { name: /opslaan|toevoegen/i }).closest("form")!);
    await waitFor(() => expect(mainLocations().some((r) => r.name === "Nieuw Gebouw")).toBe(true));
    expect(mainLocations().find((r) => r.name === "Nieuw Gebouw")?.details).toMatchObject({ prefix: "NGB" });
  });
});
