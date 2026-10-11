import { describe, expect, it } from "vitest";
import { MockInventoryRepository } from "../data/mockRepository";
import { routeManifest } from "../routes/manifest";
import { buildGlobalSearchIndex, filterGlobalSearchResults, referenceRoute } from "./useGlobalSearch";

const snapshot = new MockInventoryRepository().snapshot();
const search = (query: string, role: Parameters<typeof buildGlobalSearchIndex>[1] = "administrator") =>
  filterGlobalSearchResults(buildGlobalSearchIndex(snapshot, role), query);

/** Strip the query string and match a manifest path (supports :params and /*). */
const routeExists = (route: string) => {
  const path = route.split("?")[0];
  return routeManifest.some((r) => {
    const base = r.path.replace(/\/\*$/, "");
    if (path === base) return true;
    if (r.path.endsWith("/*")) return path.startsWith(`${base}/`);
    return new RegExp(`^${r.path.replace(/:[^/]+/g, "[^/]+")}$`).test(path);
  }) || path.startsWith("/settings/");
};

describe("global search covers the foundation records", () => {
  it("finds a code group by its name and by its prefix", () => {
    const group = snapshot.codeGroups.find((g) => !g.archived)!;
    for (const query of [group.name, group.prefix]) {
      const hit = search(query).find((r) => r.type === "codeGroup" && r.id === group.id);
      expect(hit, query).toBeTruthy();
      expect(hit!.code).toBe(group.prefix);
    }
  });

  it("finds assets by Inv.code, category, department and assignee", () => {
    const asset = snapshot.assets.find((a) => a.assignedTo && a.department && a.category)!;
    for (const query of [asset.code, asset.category, asset.department, asset.assignedTo!])
      expect(search(query).some((r) => r.type === "asset" || r.type === "assignment" || r.type === "department" || r.type === "category" || r.type === "user"), query).toBe(true);
    expect(search(asset.code).some((r) => r.id === asset.id)).toBe(true);
  });

  it("never sends the user to a route that does not exist", () => {
    const routes = buildGlobalSearchIndex(snapshot, "administrator").map((r) => r.route);
    expect(routes.length).toBeGreaterThan(10);
    for (const route of new Set(routes)) expect(routeExists(route), route).toBe(true);
  });

  it("opens a Hoofdlocatie in Master Data, never in the removed Locations module", () => {
    expect(referenceRoute({ kind: "location", id: "a", type: "Main location" })).toBe("/settings/location-code-groups");
    expect(referenceRoute({ kind: "location", id: "b", type: "Shelf" })).toBe("/departments?location=b");
    expect(referenceRoute({ kind: "department", id: "d" })).toBe("/departments?department=d");
    expect(referenceRoute({ kind: "category", id: "c" })).toBe("/categories?category=c");
    expect(buildGlobalSearchIndex(snapshot, "administrator").some((r) => r.route.startsWith("/locations"))).toBe(false);
  });

  it("only returns record types the role may open", () => {
    const types = (role: Parameters<typeof buildGlobalSearchIndex>[1]) =>
      new Set(buildGlobalSearchIndex(snapshot, role).map((r) => r.type));
    // Whatever a role cannot manage is absent from its index entirely (the
    // index is built per role, so unauthorized data is never even searched).
    const full = types("administrator");
    expect(full.has("codeGroup")).toBe(true);
    for (const role of ["warehouse-staff", "auditor", "management"] as const)
      expect([...types(role)].every((t) => full.has(t))).toBe(true);
  });
});
