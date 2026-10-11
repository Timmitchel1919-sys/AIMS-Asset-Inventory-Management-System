// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";
import { applyStarterLocations } from "./starterLocations";
import { STARTER_DEPARTMENTS, planStarterLocations, starterPlanIsEmpty } from "../domain/starterLocations";

describe("starter locations: Kangoeroe High and Lokaal 2 - 16", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => {
    localStorage.setItem("kcs-language", "en");
    repo = new MockInventoryRepository();
  });
  const mains = () => repo.snapshot().references.filter((r) => r.kind === "location" && r.type === "Main location");
  const departments = () => repo.snapshot().references.filter((r) => r.kind === "department");
  const stateOf = () => (repo as unknown as { state: { references: unknown[] } }).state;

  it("is exactly Lokaal 2 through Lokaal 16", () => {
    expect(STARTER_DEPARTMENTS).toHaveLength(15);
    expect(STARTER_DEPARTMENTS[0]).toBe("Lokaal 2");
    expect(STARTER_DEPARTMENTS.at(-1)).toBe("Lokaal 16");
  });

  it("uses an existing Kangoeroe High and adds the 15 classrooms under it", async () => {
    const high = mains().find((r) => r.name === "Kangoeroe High")!;
    const before = mains().length;
    const result = await applyStarterLocations(repo, "en");
    expect(result.ok, result.message).toBe(true);
    expect(result.createdMain).toBe(false);
    expect(result.createdDepartments).toHaveLength(15);
    expect(mains()).toHaveLength(before);
    for (const name of STARTER_DEPARTMENTS)
      expect(departments().find((d) => d.name === name)).toMatchObject({ mainLocationId: high.id, status: "Active" });
  });

  it("creates Kangoeroe High (with a unique code) when it does not exist, so it appears in the department dropdown", async () => {
    stateOf().references = repo.snapshot().references.filter((r) => !(r.type === "Main location" && r.name === "Kangoeroe High"));
    expect(mains().some((r) => r.name === "Kangoeroe High")).toBe(false);
    const result = await applyStarterLocations(repo, "en");
    expect(result.ok, result.message).toBe(true);
    expect(result.createdMain).toBe(true);
    const high = mains().find((r) => r.name === "Kangoeroe High")!;
    expect(high).toMatchObject({ status: "Active", details: expect.objectContaining({ prefix: "KH" }) });
    // The department form lists exactly the active Main locations.
    const dropdown = repo.snapshot().references.filter((x) => x.kind === "location" && x.type === "Main location" && x.status === "Active");
    expect(dropdown.map((r) => r.name)).toContain("Kangoeroe High");
    expect(departments().filter((d) => d.mainLocationId === high.id)).toHaveLength(15);
  });

  it("falls back to another code when KH is already used by a different Hoofdlocatie", async () => {
    stateOf().references = repo.snapshot().references.filter((r) => !(r.type === "Main location" && r.name === "Kangoeroe High"));
    const other = mains()[0];
    await repo.execute({ action: "reference.edit", entityId: other.id, values: { details: { ...other.details, prefix: "KH" } } });
    const result = await applyStarterLocations(repo, "en");
    expect(result.ok, result.message).toBe(true);
    expect(mains().find((r) => r.name === "Kangoeroe High")?.details.prefix).toBe("KHS");
  });

  it("is idempotent and never duplicates or renames anything", async () => {
    await applyStarterLocations(repo, "en");
    const afterFirst = JSON.stringify(repo.snapshot().references.map((r) => [r.id, r.name, r.status]));
    expect(starterPlanIsEmpty(planStarterLocations(repo.snapshot().references))).toBe(true);
    const second = await applyStarterLocations(repo, "en");
    expect(second.ok).toBe(true);
    expect(second.createdDepartments).toHaveLength(0);
    expect(JSON.stringify(repo.snapshot().references.map((r) => [r.id, r.name, r.status]))).toBe(afterFirst);
  });

  it("only fills the gaps when some classrooms already exist (matching ignores case and spacing)", async () => {
    const high = mains().find((r) => r.name === "Kangoeroe High")!;
    await repo.execute({ action: "reference.create", values: { kind: "department", name: " lokaal  5 ", type: "Department", mainLocationId: high.id } });
    const result = await applyStarterLocations(repo, "en");
    expect(result.createdDepartments).toHaveLength(14);
    expect(result.createdDepartments).not.toContain("Lokaal 5");
    expect(departments().filter((d) => d.mainLocationId === high.id && d.name.trim().toLowerCase().replace(/\s+/g, " ") === "lokaal 5")).toHaveLength(1);
  });

  it("does nothing when Kangoeroe High exists but is inactive (no silent reactivation)", async () => {
    const high = mains().find((r) => r.name === "Kangoeroe High")!;
    await repo.execute({ action: "reference.edit", entityId: high.id, values: { status: "Inactive" } });
    const before = departments().length;
    const result = await applyStarterLocations(repo, "en");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not active/);
    expect(departments()).toHaveLength(before);
    expect(mains().find((r) => r.id === high.id)!.status).toBe("Inactive");
  });

  it("reports in Dutch", async () => {
    const result = await applyStarterLocations(repo, "nl");
    expect(result.message).toContain("afdeling(en) toegevoegd");
  });
});
